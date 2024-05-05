/**
 * domain, proposal 多对多
 * proposal+round, conference 一对多
 * conference, solution 一对多
 *
 * commit solution 前需要 set proposal properties
 * 第一次 commit solution 后自动分配 conference
 * 每个 conference 中可提交若干 solution
 *
 * 投票权限 public 但投票前需要 set proposal properties
 * 只能在进行中/公示中的会议中投票
 * 公示中的票数影响公示期的长度，超过半数同意公示期为0
 *
 * 会议中票数最多的 solution 晋级（平票时多个solution晋级），solution 投票数继承上一轮
 * 如果未晋级也可提交新的 solution 重新分配 conference（票数为0）
 *
 * 评论权限 public
 */
import {
  CommonProposal,
  CommonSolution,
  ConferenceID,
  ConferenceStatus,
  DBConference,
  VITask,
  Context,
  DBProposal,
  DBBlock,
} from '../../../shared/types';
import {
  IPFSAddress,
  ProposalStatus,
  ProposalProperties,
  SolutionID,
  ProposalID,
  NodeID,
  IDatabase,
} from '../types';
import ComputedVote from './entity/computed-vote';
import ProposalEntity from './entity/proposal';
import SolutionEntity from './entity/solution';
import VoteLog from './entity/vote-log';
import ConferenceEntity from './entity/conference';
import DomainProposalPair from './entity/domain-proposal-pair';
import Task from './entity/task';
import { decode, encode, gen_id } from '../utils';
import SolutionTaskPair from './entity/solution-task-pair';
import ConferenceSolutionPair from './entity/conference-solution-pair';
import SolutionComment from './entity/solution-comment';
import ProposalComment from './entity/proposal-comment';
import ProposalPeerPair from './entity/proposal-peer-pair';
import ConferencePeerPair from './entity/conference-peer-pair';
import ProposalRoundPair from './entity/proposal-round-pair';
import { validate_proposal_properties } from '../simple_validator';
import { EntityManager, In, LessThan, QueryRunner } from 'typeorm';
import {
  MAX_PUBLICITY_DURATION,
  MAX_TIMESTAMP,
} from '../../../shared/constant';

function n_participant_to_publicity_duration(
  n_participant: number,
  n_total: number,
) {
  n_participant--;
  n_total--;
  if (n_participant / n_total > 0.5) {
    return 0;
  } else {
    return (1 - (n_participant / n_total) * 2) * MAX_PUBLICITY_DURATION;
  }
}

/**
 * [插入] task
 * [插入] solution
 * [插入] solution task pair
 *
 * 如果会议人数将超出 max_computed_n_proposer
 *  [插入] conference
 *  [更新] proposal (computed_latest_conference)
 * 否则
 *  [插入] conference peer pair
 *  [更新] conference (computed_n_proposer)
 * [插入] onging conference peer
 *
 * [插入] conference solution pair
 * vote_solution
 */
export async function commit_solution(
  manager: EntityManager,
  mid: NodeID,
  proposal_id: ProposalID,
  solution: CommonSolution,
  initial?: boolean,
) {
  const solution_id = gen_id();
  const task_ids = solution.tasks.map((i) => gen_id());
  await Promise.all(
    solution.tasks.map(
      async (task, idx) =>
        await manager.insert(Task, {
          uuid: task_ids[idx],
          type: task.type,
          args: await encode(task),
        }),
    ),
  );

  await manager.insert(SolutionEntity, {
    uuid: solution_id,
    peer_uuid: mid,
    content_cid: solution.content_cid,
  });

  await Promise.all(
    solution.tasks.map((task, idx) =>
      manager.insert(SolutionTaskPair, {
        task_uuid: task_ids[idx],
        solution_uuid: solution_id,
      }),
    ),
  );

  const proposal = await manager.findOne(ProposalEntity, {
    where: { uuid: proposal_id },
  });

  const conference_id =
    (await get_which_conference(
      manager,
      proposal_id,
      proposal.computed_n_round,
      mid,
    )) || proposal.computed_latest_conference_id;

  const conference = await manager.findOne(ConferenceEntity, {
    where: { uuid: conference_id },
  });

  if (conference.computed_n_proposer < proposal.computed_max_n_proposer) {
    if (!initial) {
      await conference_add_peers(
        manager,
        [mid],
        proposal_id,
        conference.uuid,
        conference.round_id,
      );
    }
  } else {
    const new_id = await proposal_add_empty_conference(
      manager,
      proposal_id,
      conference.round_id,
    );
    await conference_add_peers(
      manager,
      [mid],
      proposal_id,
      new_id,
      conference.round_id,
    );
  }

  await manager.insert(ConferenceSolutionPair, {
    solution_uuid: solution_id,
    conference_uuid: conference_id,
    round_id: proposal.computed_n_round,
  });
  await vote_solution(manager, mid, proposal_id, conference_id, solution_id);
}
async function update_proposal_computed(
  manager: EntityManager,
  {
    proposal_id,
    accumulated_discussion_voting_duration,
    accumulated_max_n_proposer,
    n_participant,
    round_start,
    N,
    round_id,
  }: {
    proposal_id: ProposalID;
    accumulated_max_n_proposer: number;
    N: number;
    accumulated_discussion_voting_duration: number;
    n_participant: number;
    round_start?: number;
    round_id: number;
  },
) {
  const computed_discussion_voting_duration = Math.floor(
    accumulated_discussion_voting_duration / n_participant,
  );
  await manager.update(
    ProposalEntity,
    {
      id: proposal_id,
    },
    {
      accumulated_max_n_proposer,
      accumulated_discussion_voting_duration,

      computed_n_participant: n_participant,

      computed_max_n_proposer: Math.floor(
        accumulated_max_n_proposer / n_participant,
      ),
      computed_discussion_voting_duration,

      computed_discussion_voting_end:
        round_start + computed_discussion_voting_duration,
      computed_publicity_end:
        round_start +
        computed_discussion_voting_duration +
        n_participant_to_publicity_duration(n_participant, N),
    },
  );
  await manager.upsert(
    ProposalRoundPair,
    {
      proposal_uuid: proposal_id,
      round_id,
      start_timestamp: round_start,
      end_timestamp: round_start + computed_discussion_voting_duration,
    },
    { conflictPaths: ['proposal_uuid', 'round_id'] },
  );
  await manager.update(
    DomainProposalPair,
    {
      proposal_id,
    },
    {
      computed_n_participant: n_participant,
    },
  );
}

/**
 * 如果不存在 proposal peer pair
 *  [插入] proposal peer pair
 * 否则
 *  [更新] proposal peer pair
 * [更新] proposal.computed_xxx
 * [更新] domain proposal.n_participant
 */
export async function set_proposal_properties(
  manager: EntityManager,
  N: number,
  node_id: NodeID,
  proposal_uuid: ProposalID,
  properties: Partial<ProposalProperties>,
) {
  let pair = await manager.findOne(ProposalPeerPair, {
    where: {
      proposal_uuid: proposal_uuid,
      peer_uuid: node_id,
    },
  });

  const proposal = await manager.findOne(ProposalEntity, {
    where: { uuid: proposal_uuid },
  });
  let n_participant = proposal.computed_n_participant;
  let accumulated_max_n_proposer = proposal.accumulated_max_n_proposer;
  let accumulated_discussion_voting_duration =
    proposal.accumulated_discussion_voting_duration;
  if (!pair) {
    if (!validate_proposal_properties(properties as ProposalProperties)) {
      return;
    }
    await manager.insert(ProposalPeerPair, {
      proposal_uuid: proposal_uuid,
      peer_uuid: node_id,
      ...properties,
    });
    pair = await manager.findOne(ProposalPeerPair, {
      where: {
        proposal_uuid: proposal_uuid,
        peer_uuid: node_id,
      },
    });

    n_participant++;
    accumulated_max_n_proposer += properties.max_n_proposer;
    accumulated_discussion_voting_duration +=
      properties.discussion_voting_duration;
  } else {
    await manager.update(
      ProposalPeerPair,
      {
        proposal_id: proposal_uuid,
        peer_id: node_id,
      },
      {
        ...properties,
      },
    );
    accumulated_max_n_proposer +=
      properties.max_n_proposer - pair.max_n_proposer;
    accumulated_discussion_voting_duration +=
      properties.discussion_voting_duration - pair.discussion_voting_duration;
  }

  await update_proposal_computed(manager, {
    proposal_id: proposal.uuid,
    accumulated_max_n_proposer,
    accumulated_discussion_voting_duration,
    n_participant,
    N,
    round_start: proposal.make_proposal_timestamp,
    round_id: proposal.computed_n_round,
  });
}
/**
 * [插入] vote log
 * 如果不存在 computed vote
 *  [插入] computed vote
 * 否则
 *  [更新] computed vote
 *  如果 vote > conference.max_n_vote
 *    [更新] conference.max_n_vote
 */
export async function vote_solution(
  manager: EntityManager,
  mid: NodeID,
  proposal_id: ProposalID,
  conference_id: string,
  solution_id: SolutionID,
) {
  await manager.upsert(
    VoteLog,
    {
      peer_uuid: mid,
      conference_uuid: conference_id,
      solution_uuid: solution_id,
    },
    { conflictPaths: ['peer_uuid', 'conference_uuid', 'solution_uuid'] },
  );

  const computed_vote = await manager.findOne(ComputedVote, {
    where: {
      conference_id: conference_id,
      solution_uuid: solution_id,
    },
  });
  let n_vote = 1;
  if (!computed_vote) {
    await manager.insert(ComputedVote, {
      conference_id: conference_id,
      solution_uuid: solution_id,
      n_vote,
    });
  } else {
    n_vote = computed_vote.n_vote + 1;
    await manager.update(
      ComputedVote,
      {
        conference_id: conference_id,
        solution_id: solution_id,
      },
      {
        n_vote,
      },
    );
  }
  const max_n_vote = (
    await manager.findOne(ConferenceEntity, {
      where: {
        uuid: conference_id,
      },
    })
  ).computed_max_n_vote;
  if (max_n_vote < n_vote) {
    await manager.update(ConferenceEntity, conference_id, {
      computed_max_n_vote: n_vote,
    });
  }
}

async function conference_add_peers(
  manager: EntityManager,
  mids: NodeID[],
  proposal_id: ProposalID,
  conference_id: ConferenceID,
  round_id: number,
) {
  for (const mid of mids) {
    await manager.insert(ConferencePeerPair, {
      peer_uuid: mid,
      conference_uuid: conference_id,
      round_id: round_id,
      proposal_uuid: proposal_id,
    });
  }
  await manager.increment(
    ConferenceEntity,
    {
      id: conference_id,
    },
    'computed_n_proposer',
    mids.length,
  );
}
async function proposal_add_empty_conference(
  manager: EntityManager,
  proposal_id: ProposalID,
  round_id: number,
) {
  const conference_id = gen_id();
  const db_conference: DBConference = {
    uuid: conference_id,
    round_id,
    computed_n_proposer: 0,
    computed_max_n_vote: 0,
    proposal_uuid: proposal_id,
    status: ConferenceStatus.ready,
  };
  await manager.insert(ConferenceEntity, db_conference);
  await manager.update(
    ProposalEntity,
    {
      id: proposal_id,
    },
    {
      computed_latest_conference_id: conference_id,
    },
  );
  return conference_id;
}

async function set_proposal_status(
  manager: EntityManager,
  proposal_id: ProposalID,
  status: ProposalStatus,
) {
  await manager.update(
    DomainProposalPair,
    {
      proposal_id,
    },
    {
      proposal_status: status,
    },
  );
  await manager.update(
    ProposalEntity,
    {
      id: proposal_id,
    },
    { status },
  );
}

export async function get_which_conference(
  manager: EntityManager,
  proposal_id: ProposalID,
  round_id: number,
  mid: NodeID,
) {
  const pair = await manager.findOne(ConferencePeerPair, {
    where: {
      peer_uuid: mid,
      round_id,
      proposal_uuid: proposal_id,
    },
  });
  return pair ? pair.conference_uuid : undefined;
}
export async function get_conferences(
  manager: EntityManager,
  proposal_id: ProposalID,
  round_id: number,
  page: number,
  n = 20,
) {
  const conferences = await manager.find(ConferenceEntity, {
    where: {
      proposal_uuid: proposal_id,
      round_id,
    },
    take: n,
    skip: (page - 1) * n,
  });
  return conferences;
}

export async function get_conference_solutions(
  manager: EntityManager,
  proposal_id: ProposalID,
  round_id: number,
  conference_id: ConferenceID,
  page: number,
  n = 20,
) {
  const pairs = await manager.find(ConferenceSolutionPair, {
    where: {
      conference_uuid: conference_id,
    },
    take: n,
    skip: (page - 1) * n,
  });
  return pairs;
}

export async function activate(
  manager: EntityManager,
  proposal_id: ProposalID,
) {
  await set_proposal_status(
    manager,
    proposal_id,
    ProposalStatus.discussing_voting,
  );
}

export async function get_proposal(
  manager: EntityManager,
  proposal_id: ProposalID,
) {
  return await manager.findOne(ProposalEntity, {
    where: {
      uuid: proposal_id,
    },
  });
}

export async function get_proposal_status(
  manager: EntityManager,
  proposal_id: ProposalID,
) {
  const proposal = await manager.findOne(ProposalEntity, {
    where: {
      uuid: proposal_id,
    },
  });
  return proposal ? proposal.status : undefined;
}

export async function add_proposal_comment(
  manager: EntityManager,
  mid_b58: NodeID,
  proposal_id: ProposalID,
  content_cid,
) {
  await manager.insert(ProposalComment, {
    proposal_uuid: proposal_id,
    content_cid,
    peer_uuid: mid_b58,
  });
}

export async function add_solution_comment(
  manager: EntityManager,
  mid_b58: NodeID,
  solution_id: SolutionID,
  content_cid,
) {
  await manager.insert(SolutionComment, {
    solution_uuid: solution_id,
    content_cid,
    peer_uuid: mid_b58,
  });
}

export async function is_participant(
  manager: EntityManager,
  proposal_id: ProposalID,
  mid: NodeID,
): Promise<boolean> {
  return !!(await manager.count(ProposalPeerPair, {
    where: {
      peer_uuid: mid,
      proposal_uuid: proposal_id,
    },
  }));
}

export async function get_n_participant(
  manager: EntityManager,
  proposal_id: ProposalID,
) {
  return (
    await manager.findOne(ProposalEntity, {
      where: {
        uuid: proposal_id,
      },
    })
  ).computed_n_participant;
}

export async function has_solution(
  manager: EntityManager,
  solution_id: SolutionID,
) {
  return !!(await manager.count(SolutionEntity, {
    where: {
      uuid: solution_id,
    },
  }));
}

export async function has_proposal(
  manager: EntityManager,
  proposal_id: ProposalID,
) {
  return !!(await manager.count(ProposalEntity, {
    where: {
      uuid: proposal_id,
    },
  }));
}

export async function get_votes(
  manager: EntityManager,
  proposal_id: ProposalID,
  conference_id: ConferenceID,
  solution_id: SolutionID,
) {
  return (
    await manager.findOne(ComputedVote, {
      where: {
        conference_id,
        solution_uuid: solution_id,
      },
    })
  ).n_vote;
}

export async function has_vote_solution(
  manager: EntityManager,
  mid: NodeID,
  conference_id: string,
  solution_id: SolutionID,
) {
  return !!(await manager.count(VoteLog, {
    where: {
      peer_uuid: mid,
      conference_uuid: conference_id,
      solution_uuid: solution_id,
    },
  }));
}

/**
 * [插入] domain proposal pair
 * [插入] proposal
 * [插入] proposal round pair
 * commit solution
 */
export async function add_proposal(
  manager: EntityManager,
  N: number,
  prev_block_cid: IPFSAddress<DBBlock>,
  mid: NodeID,
  proposal: CommonProposal,
  start_timestamp: number,
) {
  const proposal_id = gen_id();
  const round_id = 1;
  await Promise.all(
    proposal.domain_uuids.map((i) =>
      manager.insert(DomainProposalPair, {
        proposal_uuid: proposal_id,
        domain_uuid: i,
        computed_n_participant: 0,
        proposal_status: ProposalStatus.inactivated,
      }),
    ),
  );

  const db_proposal: DBProposal = {
    uuid: proposal_id,

    prev_block_cid: prev_block_cid,

    content_cid: proposal.content_cid,

    title: proposal.title,
    originator_id: mid,
    status: ProposalStatus.inactivated,

    accumulated_discussion_voting_duration: 0,
    accumulated_max_n_proposer: 0,

    computed_n_round: round_id,
    computed_n_participant: 0,
    computed_discussion_voting_duration: 0,
    computed_max_n_proposer: 0,
    computed_discussion_voting_end: 0,
    computed_publicity_end: 0,

    make_proposal_timestamp: start_timestamp,
    computed_final_solution_id: '',
    computed_final_conference_id: '',
    computed_latest_conference_id: '',
  };
  await manager.insert(ProposalEntity, db_proposal);
  await manager.insert(ProposalRoundPair, {
    proposal_uuid: proposal_id,
    round_id,
  });

  const conference_id = await proposal_add_empty_conference(
    manager,
    proposal_id,
    round_id,
  );
  await conference_add_peers(
    manager,
    [mid],
    proposal_id,
    conference_id,
    round_id,
  );
  await set_proposal_properties(manager, N, mid, proposal_id, proposal.properties);
  await commit_solution(
    manager,
    mid,
    proposal_id,
    proposal.default_solution,
    true,
  );
}

export async function freeze(manager, proposal_id: ProposalID) {
  await set_proposal_status(manager, proposal_id, ProposalStatus.freezed);
}

/**
 * 对于每个状态为 discussing_voting 且 computed_disscussion_voting_end 小于 block_end_timestamp 的 proposal
 *  candidate_peer_solutions = []
 *  对于每一个 round_id 为 proposal.computed_n_round 的 conference
 *    更新 conference 的状态为 done
 *    记录其中的 solutions 到 candidate_peer_solutions
 *  如果 solutions.length 为 1
 *    更新 proposal 状态为 publicizing , computed_final_solution_id, computed_publicizing_end
 *  如果 solutions.length 大于 1
 *    while (candidate_peer_solutions)
 *      candiates = candidate_peer_solutions.splice(0, computed_max_n_proposer)
 *      [插入] conference
 *      [插入] conference_solution
 *      [插入] ongoing conference peer
 *  [更新] proposal (computed_n_round, copmuted_latest_conference)
 *  [插入] proposal round pair
 * 对于每个状态为 publicizing 且 computed_publicizing_end 小于 block_end_timestamp 的 proposal
 *  [更新] proposal 状态为 executing
 *  return tasks
 */
export async function update_lifecycle(manager, N: number, block_end_timestamp: number) {
  const res = new Map<ProposalID, VITask[]>();
  for (const proposal of await manager.find(ProposalEntity, {
    where: {
      status: ProposalStatus.discussing_voting,
      computed_discussion_voting_end: LessThan(block_end_timestamp),
    },
  })) {
    const conferences = await manager.find(ConferenceEntity, {
      where: {
        proposal_id: proposal.uuid,
        round_id: proposal.computed_n_round,
      },
    });
    const candidate_solutions = new Map<NodeID, Set<SolutionID>>();
    for (const conference of conferences) {
      const computed_votes = await manager.find(ComputedVote, {
        where: {
          conference_id: conference.uuid,
          n_vote: conference.computed_max_n_vote,
        },
      });
      for (const computed_vote of computed_votes) {
        const solution = await manager.findOne(SolutionEntity, {
          where: {
            uuid: computed_vote.solution_id,
          },
        });
        if (!candidate_solutions.get(solution.peer_id)) {
          candidate_solutions.set(solution.peer_id, new Set());
        }
        candidate_solutions.get(solution.peer_id).add(solution.uuid);
      }
      await manager.update(
        ConferenceEntity,
        {
          id: conference.uuid,
        },
        {
          status: ConferenceStatus.done,
        },
      );
    }
    if (
      candidate_solutions.size === 1 &&
      candidate_solutions.get(candidate_solutions.keys().next().value).size ===
        1
    ) {
      const solutions_set = candidate_solutions.get(
        candidate_solutions.keys().next().value,
      );
      const solution_id = solutions_set.keys().next().value;
      await set_proposal_status(
        manager,
        proposal.uuid,
        ProposalStatus.publicizing,
      );
      const conference_id = (
        await manager.findOne(ConferenceSolutionPair, {
          where: {
            solution_id,
            round_id: proposal.computed_n_round,
          },
        })
      ).conference_id;
      await manager.update(
        ProposalEntity,
        {
          id: proposal.uuid,
        },
        {
          computed_final_solution_id: solution_id,
          computed_final_conference_id: conference_id,
        },
      );
    } else {
      const round_id = proposal.computed_n_round + 1;
      const candidate_array = Array.from(candidate_solutions.keys());
      while (candidate_array.length) {
        const peer_ids = candidate_array.slice(
          0,
          proposal.computed_max_n_proposer,
        );
        const conference_id = await proposal_add_empty_conference(
          manager,
          proposal.uuid,
          round_id,
        );
        await conference_add_peers(
          manager,
          peer_ids,
          proposal.uuid,
          conference_id,
          round_id,
        );
        const solution_ids = peer_ids.reduce((m, peer_id) => {
          m.push(...candidate_solutions.get(peer_id));
          return m;
        }, []);
        await manager.insert(
          ConferenceSolutionPair,
          solution_ids.map((i) => ({
            conference_id: conference_id,
            round_id,
            solution_id: i,
          })),
        );
      }
      await update_proposal_computed(manager, {
        proposal_id: proposal.uuid,
        N,
        accumulated_max_n_proposer: proposal.accumulated_max_n_proposer,
        accumulated_discussion_voting_duration:
          proposal.computed_discussion_voting_duration,
        n_participant: proposal.computed_n_participant,
        round_start: block_end_timestamp, // block 结束后再更新似乎更合理
        // round_start: proposal.computed_discussion_voting_end,
        round_id,
      });
    }
  }
  for (const proposal of await manager.find(ProposalEntity, {
    where: {
      status: ProposalStatus.publicizing,
      computed_publicity_end: LessThan(block_end_timestamp),
    },
  })) {
    const tasks: VITask[] = [];
    await set_proposal_status(manager, proposal.uuid, ProposalStatus.executing);
    const tmp = await Promise.all(
      (
        await manager.find(SolutionTaskPair, {
          where: {
            solution_id: proposal.computed_final_solution_id,
          },
        })
      ).map((i) =>
        manager.findOne(Task, {
          where: {
            uuid: i.task_id,
          },
        }),
      ),
    );
    for (const i of tmp) {
      tasks.push({
        type: i.type,
        ...(await decode(i.args)),
      });
    }
    res.set(proposal.uuid, tasks);
  }
  return res;
}

export async function finish(manager, proposal_id: ProposalID) {
  await set_proposal_status(manager, proposal_id, ProposalStatus.done);
}

export async function get_solution(manager, id: SolutionID) {
  const solution = await manager.findOne(SolutionEntity, {
    where: { uuid: id },
  });
  const pairs = await manager.find(SolutionTaskPair, {
    where: {
      solution_id: id,
    },
  });
  const tasks = await manager.find(Task, {
    where: {
      uuid: In(pairs.map((i) => i.task_id)),
    },
  });
  const comments = await manager.find(SolutionComment, {
    where: {
      solution_id: id,
    },
  });
  return {
    solution,
    comments,
    tasks,
  };
}

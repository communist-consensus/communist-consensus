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
import { CommonProposal, CommonSolution, ConferenceID, ConferenceStatus, DBConference, DBProposal, RIPeerEvent, VITask } from '../../shared/types';
import {
  IDBProposal,
  IPFSAddress,
  ProposalStatus,
  ProposalProperties,
  SolutionID,
  ProposalID,
  MID_B58,
  IDatabase,
} from '../types';
import ComputedVote from './entity/computed-vote';
import ProposalEntity from './entity/proposal';
import SolutionEntity from './entity/solution';
import VoteLog from './entity/vote-log';
import ConferenceEntity from './entity/conference';
import DomainProposalPair from './entity/domain-proposal-pair';
import Task from './entity/task';
import { decode, encode } from '../utils';
import SolutionTaskPair from './entity/solution-task-pair';
import ConferenceSolutionPair from './entity/conference-solution-pair';
import SolutionComment from './entity/solution-comment';
import ProposalComment from './entity/proposal-comment';
import ProposalPeerPair from './entity/proposal-peer-pair';
import ConferencePeerPair from './entity/conference-peer-pair';
import ProposalRoundPair from './entity/proposal-round-pair';
import { validate_proposal_properties } from '../simple_validator';
import { In, LessThan } from 'typeorm';
import { MAX_PUBLICITY_DURATION, MAX_TIMESTAMP } from '../../shared/constant';

function n_participant_to_publicity_duration(n_participant: number, n_total: number) {
  n_participant--;
  n_total--;
  if (n_participant / n_total > 0.5) {
    return 0;
  } else {
    return (1 - (n_participant / n_total) * 2) * MAX_PUBLICITY_DURATION;
  }
}

export default class APIProposal implements IDBProposal {
  db: IDatabase;
  constructor(db: IDatabase) {
    this.db = db;
  }

  public async get_which_conference(
    proposal_id: ProposalID,
    round_id: number,
    mid: MID_B58,
  ) {
    const pair = await this.db.connection.manager.findOne(ConferencePeerPair, {
      peer_id: mid,
      round_id,
      proposal_id,
    });
    return pair ? pair.conference_id : undefined;
  }

  public async get_conferences(
    proposal_id: ProposalID,
    round_id: number,
    page: number,
    n = 20,
  ) {
    const conferences = await this.db.connection.manager.find(
      ConferenceEntity,
      {
        where: {
          proposal_id,
          round_id,
        },
        take: n,
        skip: (page - 1) * n,
      },
    );
    return conferences;
  }

  public async get_conference_solutions(
    proposal_id: ProposalID,
    round_id: number,
    conference_id: ConferenceID,
    page: number,
    n = 20,
  ) {
    const pairs = await this.db.connection.manager.find(
      ConferenceSolutionPair,
      {
        where: {
          conference_id,
        },
        take: n,
        skip: (page - 1) * n,
      },
    );
    return pairs;
  }

  public async activate(proposal_id: ProposalID) {
    await this.set_proposal_status(
      proposal_id,
      ProposalStatus.discussing_voting,
    );
  }

  public async get_proposal(proposal_id: ProposalID) {
    return await this.db.connection.manager.findOne(
      ProposalEntity,
      proposal_id,
    );
  }

  public async get_proposal_status(proposal_id: ProposalID) {
    const proposal = await this.db.connection.manager.findOne(
      ProposalEntity,
      proposal_id,
    );
    return proposal ? proposal.status : undefined;
  }

  public async add_proposal_comment(
    mid_b58: MID_B58,
    proposal_id: ProposalID,
    content_cid: IPFSAddress,
  ) {
    await this.db.connection.manager.insert(ProposalComment, {
      proposal_id,
      content_cid,
      peer_id: mid_b58,
    });
  }

  public async add_solution_comment(
    mid_b58: MID_B58,
    solution_id: SolutionID,
    content_cid: IPFSAddress,
  ) {
    await this.db.connection.manager.insert(SolutionComment, {
      solution_id,
      content_cid,
      peer_id: mid_b58,
    });
  }

  public async is_participant(
    proposal_id: ProposalID,
    mid: MID_B58,
  ): Promise<boolean> {
    return !!(await this.db.connection.manager.count(ProposalPeerPair, {
      peer_id: mid,
      proposal_id: proposal_id,
    }));
  }

  public async get_n_participant(proposal_id: ProposalID) {
    return (
      await this.db.connection.manager.findOne(ProposalEntity, {
        id: proposal_id,
      })
    ).computed_n_participant;
  }

  public async has_solution(solution_id: SolutionID) {
    return !!(await this.db.connection.manager.count(SolutionEntity, {
      id: solution_id,
    }));
  }

  public async has_proposal(proposal_id: ProposalID) {
    return !!(await this.db.connection.manager.count(ProposalEntity, {
      id: proposal_id,
    }));
  }

  public async get_votes(
    proposal_id: ProposalID,
    conference_id: ConferenceID,
    solution_id: SolutionID,
  ) {
    return (
      await this.db.connection.manager.findOne(ComputedVote, {
        conference_id,
        solution_id,
      })
    ).n_vote;
  }

  public async has_vote_solution(
    mid: MID_B58,
    conference_id: string,
    solution_id: SolutionID,
  ) {
    return !!(await this.db.connection.manager.count(VoteLog, {
      peer_id: mid,
      conference_id: conference_id,
      solution_id: solution_id,
    }));
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
  public async vote_solution(
    mid: MID_B58,
    proposal_id: ProposalID,
    conference_id: string,
    solution_id: SolutionID,
  ) {
    await this.db.connection.manager.upsert(
      VoteLog,
      {
        peer_id: mid,
        conference_id: conference_id,
        solution_id: solution_id,
      },
      { conflictPaths: ['peer_id', 'conference_id', 'solution_id'] },
    );

    const computed_vote = await this.db.connection.manager.findOne(
      ComputedVote,
      {
        conference_id: conference_id,
        solution_id: solution_id,
      },
    );
    let n_vote = 1;
    if (!computed_vote) {
      await this.db.connection.manager.insert(ComputedVote, {
        conference_id: conference_id,
        solution_id: solution_id,
        n_vote,
      });
    } else {
      n_vote = computed_vote.n_vote + 1;
      await this.db.connection.manager.update(
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
      await this.db.connection.manager.findOne(ConferenceEntity, conference_id)
    ).computed_max_n_vote;
    if (max_n_vote < n_vote) {
      await this.db.connection.manager.update(ConferenceEntity, conference_id, {
        computed_max_n_vote: n_vote,
      });
    }
  }

  /**
   * [插入] domain proposal pair
   * [插入] proposal
   * [插入] proposal round pair
   * commit solution
   */
  public async add_proposal(
    prev_block_hash: IPFSAddress,
    mid: MID_B58,
    proposal: CommonProposal,
    start_timestamp: number,
  ) {
    const proposal_id = this.db.ctx.utils.gen_id();
    const round_id = 1;
    await Promise.all(
      proposal.domain_ids.map((i) =>
        this.db.connection.manager.insert(DomainProposalPair, {
          proposal_id: proposal_id,
          domain_id: i,
          computed_n_participant: 0,
          proposal_status: ProposalStatus.inactivated,
        }),
      ),
    );

    const db_proposal: DBProposal = {
      id: proposal_id,

      prev_block_hash,

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
    await this.db.connection.manager.insert(ProposalEntity, db_proposal);
    await this.db.connection.manager.insert(ProposalRoundPair, {
      proposal_id: proposal_id,
      round_id,
    });

    const conference_id = await this.proposal_add_empty_conference(
      proposal_id,
      round_id,
    );
    await this.conference_add_peers(
      [mid],
      proposal_id,
      conference_id,
      round_id,
    );
    await this.set_proposal_properties(mid, proposal_id, proposal.properties);
    await this.commit_solution(mid, proposal_id, proposal.default_solution, true);
  }

  async proposal_add_empty_conference(
    proposal_id: ProposalID,
    round_id: number,
  ) {
    const conference_id = this.db.ctx.utils.gen_id();
    const db_conference: DBConference = {
      id: conference_id,
      round_id,
      computed_n_proposer: 0,
      computed_max_n_vote: 0,
      proposal_id: proposal_id,
      status: ConferenceStatus.ready,
    };
    await this.db.connection.manager.insert(ConferenceEntity, db_conference);
    await this.db.connection.manager.update(
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

  async conference_add_peers(
    mids: MID_B58[],
    proposal_id: ProposalID,
    conference_id: ConferenceID,
    round_id: number,
  ) {
    for (const mid of mids) {
      await this.db.connection.manager.insert(ConferencePeerPair, {
        peer_id: mid,
        conference_id,
        round_id: round_id,
        proposal_id,
      });
    }
    await this.db.connection.manager.increment(
      ConferenceEntity,
      {
        id: conference_id,
      },
      'computed_n_proposer',
      mids.length,
    );
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
  public async commit_solution(
    mid: MID_B58,
    proposal_id: ProposalID,
    solution: CommonSolution,
    initial?: boolean,
  ) {
    const solution_id = this.db.ctx.utils.gen_id();
    const task_ids = solution.tasks.map((i) => this.db.ctx.utils.gen_id());
    await Promise.all(
      solution.tasks.map((task, idx) =>
        this.db.connection.manager.insert(Task, {
          id: task_ids[idx],
          type: task.type,
          args: encode(task), // TODO
        }),
      ),
    );

    await this.db.connection.manager.insert(SolutionEntity, {
      id: solution_id,
      peer_id: mid,
      content_cid: solution.content_cid,
    });

    await Promise.all(
      solution.tasks.map((task, idx) =>
        this.db.connection.manager.insert(SolutionTaskPair, {
          task_id: task_ids[idx],
          solution_id,
        }),
      ),
    );

    const proposal = await this.db.connection.manager.findOne(
      ProposalEntity,
      proposal_id,
    );

    const conference_id =
      (await this.get_which_conference(
        proposal_id,
        proposal.computed_n_round,
        mid,
      )) || proposal.computed_latest_conference_id;

    const conference = await this.db.connection.manager.findOne(
      ConferenceEntity,
      conference_id,
    );

    if (conference.computed_n_proposer < proposal.computed_max_n_proposer) {
      if (!initial) {
        await this.conference_add_peers(
          [mid],
          proposal_id,
          conference.id,
          conference.round_id,
        );
      }
    } else {
      const new_id = await this.proposal_add_empty_conference(
        proposal_id,
        conference.round_id,
      );
      await this.conference_add_peers(
        [mid],
        proposal_id,
        new_id,
        conference.round_id,
      );
    }

    await this.db.connection.manager.insert(
      ConferenceSolutionPair,
      {
        solution_id,
        conference_id,
        round_id: proposal.computed_n_round,
      },
    );
    await this.vote_solution(mid, proposal_id, conference_id, solution_id);
  }

  public async freeze(proposal_id: ProposalID) {
    await this.set_proposal_status(proposal_id, ProposalStatus.freezed);
  }

  private async update_proposal_computed({
    proposal_id,
    accumulated_discussion_voting_duration,
    accumulated_max_n_proposer,
    n_participant,
    round_start,
    round_id,
  }: {
    proposal_id: ProposalID;
    accumulated_max_n_proposer: number;
    accumulated_discussion_voting_duration: number;
    n_participant: number;
    round_start?: number;
    round_id: number;
  }) {
    const computed_discussion_voting_duration = Math.floor(
      accumulated_discussion_voting_duration / n_participant,
    );
    await this.db.connection.manager.update(
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
          n_participant_to_publicity_duration(
            n_participant,
            await this.db.peer.get_n_known_peers(),
          ),
      },
    );
    await this.db.connection.manager.upsert(
      ProposalRoundPair,
      {
        proposal_id,
        round_id,
        start_timestamp: round_start,
        end_timestamp: round_start + computed_discussion_voting_duration,
      },
      { conflictPaths: ['proposal_id', 'round_id'] },
    );
    await this.db.connection.manager.update(
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
  public async set_proposal_properties(
    mid: MID_B58,
    proposal_id: ProposalID,
    properties: Partial<ProposalProperties>,
  ) {
    let pair = await this.db.connection.manager.findOne(ProposalPeerPair, {
      proposal_id,
      peer_id: mid,
    });

    const proposal = await this.db.connection.manager.findOne(
      ProposalEntity,
      proposal_id,
    );
    let n_participant = proposal.computed_n_participant;
    let accumulated_max_n_proposer = proposal.accumulated_max_n_proposer;
    let accumulated_discussion_voting_duration=
        proposal.accumulated_discussion_voting_duration;
    if (!pair) {
      if (!validate_proposal_properties(properties as ProposalProperties)) {
        return;
      }
      await this.db.connection.manager.insert(ProposalPeerPair, {
        proposal_id,
        peer_id: mid,
        ...properties,
      });
      pair = await this.db.connection.manager.findOne(ProposalPeerPair, {
        proposal_id,
        peer_id: mid,
      });

      n_participant++;
      accumulated_max_n_proposer += properties.max_n_proposer;
      accumulated_discussion_voting_duration +=
        properties.discussion_voting_duration;
    } else {
      await this.db.connection.manager.update(
        ProposalPeerPair,
        {
          proposal_id,
          peer_id: mid,
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

    await this.update_proposal_computed({
      proposal_id: proposal.id,
      accumulated_max_n_proposer,
      accumulated_discussion_voting_duration,
      n_participant,
      round_start: proposal.make_proposal_timestamp,
      round_id: proposal.computed_n_round,
    });
  }

  private async set_proposal_status(
    proposal_id: ProposalID,
    status: ProposalStatus,
  ) {
    await this.db.connection.manager.update(
      DomainProposalPair,
      {
        proposal_id,
      },
      {
        proposal_status: status,
      },
    );
    await this.db.connection.manager.update(
      ProposalEntity,
      {
        id: proposal_id,
      },
      { status },
    );
  }

  /**
   * [删除] vote log
   * [更新] computed vote
   * [更新?] conference (computed_max_n_vote)
   */
  async withdraw_voting(
    peer_id: MID_B58,
    proposal_id: ProposalID,
    conference_id: ConferenceID,
    solution_id: SolutionID,
  ) {
    await this.db.connection.manager.delete(VoteLog, {
      where: {
        solution_id,
        conference_id,
        peer_id,
      },
    });
    await this.db.connection.manager.decrement(
      ComputedVote,
      {
        solution_id,
        conference_id,
      },
      'n_vote',
      1,
    );
    const max_n_vote = (
      await this.db.connection.manager.findOne(ConferenceEntity, {
        id: conference_id,
      })
    ).computed_max_n_vote;
    if (
      !(await this.db.connection.manager.count(ComputedVote, {
        where: {
          conference_id,
          n_vote: max_n_vote,
        },
      }))
    ) {
      await this.db.connection.manager.update(
        ConferenceEntity,
        {
          id: conference_id,
        },
        {
          computed_max_n_vote: max_n_vote - 1,
        },
      );
    }
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
  public async update_lifecycle(block_end_timestamp: number) {
    const res = new Map<ProposalID, VITask[]>();
    for (const proposal of await this.db.connection.manager.find(
      ProposalEntity,
      {
        where: {
          status: ProposalStatus.discussing_voting,
          computed_discussion_voting_end: LessThan(block_end_timestamp),
        },
      },
    )) {
      const conferences = await this.db.connection.manager.find(
        ConferenceEntity,
        {
          proposal_id: proposal.id,
          round_id: proposal.computed_n_round,
        },
      );
      const candidate_solutions = new Map<MID_B58, Set<SolutionID>>();
      for (const conference of conferences) {
        const computed_votes = await this.db.connection.manager.find(
          ComputedVote,
          {
            conference_id: conference.id,
            n_vote: conference.computed_max_n_vote,
          },
        );
        for (const computed_vote of computed_votes) {
          const solution = await this.db.connection.manager.findOne(
            SolutionEntity,
            computed_vote.solution_id,
          );
          if (!candidate_solutions.get(solution.peer_id)) {
            candidate_solutions.set(solution.peer_id, new Set());
          }
          candidate_solutions.get(solution.peer_id).add(solution.id);
        }
        await this.db.connection.manager.update(
          ConferenceEntity,
          {
            id: conference.id,
          },
          {
            status: ConferenceStatus.done,
          },
        );
      }
      if (
        candidate_solutions.size === 1 &&
        candidate_solutions.get(candidate_solutions.keys().next().value)
          .size === 1
      ) {
        const solutions_set = candidate_solutions.get(
          candidate_solutions.keys().next().value,
        );
        const solution_id = solutions_set.keys().next().value;
        await this.set_proposal_status(proposal.id, ProposalStatus.publicizing);
        const conference_id = (
          await this.db.connection.manager.findOne(ConferenceSolutionPair, {
            solution_id,
            round_id: proposal.computed_n_round,
          })
        ).conference_id;
        await this.db.connection.manager.update(
          ProposalEntity,
          {
            id: proposal.id,
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
          const conference_id = await this.proposal_add_empty_conference(
            proposal.id,
            round_id,
          );
          await this.conference_add_peers(
            peer_ids,
            proposal.id,
            conference_id,
            round_id,
          );
          const solution_ids = peer_ids.reduce((m, peer_id) => {
            m.push(...candidate_solutions.get(peer_id));
            return m;
          }, []);
          await this.db.connection.manager.insert(
            ConferenceSolutionPair,
            solution_ids.map((i) => ({
              conference_id: conference_id,
              round_id,
              solution_id: i,
            })),
          );
        }
        await this.update_proposal_computed({
          proposal_id: proposal.id,
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
    for (const proposal of await this.db.connection.manager.find(
      ProposalEntity,
      {
        where: {
          status: ProposalStatus.publicizing,
          computed_publicity_end: LessThan(block_end_timestamp),
        },
      },
    )) {
      const tasks: VITask[] = [];
      await this.set_proposal_status(proposal.id, ProposalStatus.executing);
      (
        await Promise.all(
          (
            await this.db.connection.manager.find(SolutionTaskPair, {
              solution_id: proposal.computed_final_solution_id,
            })
          ).map((i) => this.db.connection.manager.findOne(Task, i.task_id)),
        )
      ).forEach((task) => {
        tasks.push({
          type: task.type,
          ...decode(task.args),
        });
      });
      res.set(proposal.id, tasks);
    }
    return res;
  }

  async finish(proposal_id: ProposalID) {
    await this.set_proposal_status(proposal_id, ProposalStatus.done);
  }

  async get_solution(id: SolutionID) {
    const solution = await this.db.connection.manager.findOne(
      SolutionEntity,
      id,
    );
    const pairs = await this.db.connection.manager.find(SolutionTaskPair, {
      where: {
        solution_id: id,
      },
    });
    const tasks = await this.db.connection.manager.find(Task, {
      where: {
        id: In(pairs.map((i) => i.task_id)),
      },
    });
    const comments = await this.db.connection.manager.find(SolutionComment, {
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
}

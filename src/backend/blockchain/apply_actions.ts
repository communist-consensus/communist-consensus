import { AHEAD_OF_ROOT_BLOCK } from '../../shared/constant';
import {
  ActionBundle,
  ActionComment,
  ActionCommitSolution,
  ActionFreezeProposal,
  ActionMakeProposal,
  ActionModifyProfile,
  ActionQuit,
  ActionSetProposalProperties,
  ActionSubjects,
  ActionType,
  ActionVoteSolution,
  ActionWithdrawVoting,
  Context,
  IPFSAddress,
  MID_B58,
  PeerStatus,
  ProposalStatus,
  RIPeerEvent,
} from '../../shared/types';
import { seed_random_str, sort_n_array } from '../utils';
import * as simple_validator from '../simple_validator';
import { execute_task } from '../virtual-implementer';

/**
 * actions_broadcast 转发校验: freezed_member, start_timestamp，prev_block_hash
 * witness_broadcast 转发校验: freezed_member, basic_actions_validator, prev_block_hash, n_tries
 * apply actions 校验:
 * [basic_actions_validator]
 * freezed member
 * [actions 排序检查]
 *
 * Actions 执行顺序
 * 高优先级行为
 * initalAction
 *
 * 中优先级行为 {
 *  1.quit
 *  2.freezeProposal
 *
 *  3.makeProposal
 *
 *  4.voteSolution
 * }
 *  5.setProposalProperties
 *
 *  6.commitSolution
 *
 *  7.结算 Proposal
 *    如果status == discuss且到期
 *        status = voting
 *    如果status == voting且到期
 *      每组选出最优方案（除非投票率过低或参与数过低）
 *      如果方案数大于最大组员数，拆分并重新进入讨论
 *      否则status = publicity
 *    如果status = publicity到期
 *      status = execute
 *      执行solution.tasks
 *      status = done
 *
 *  8.排序 domain，激活 proposal
 *
 *  9.comment
 */
export default async function apply_actions(
  ctx: Context,
  action_bundle: ActionBundle,
  action_subjects: ActionSubjects,
  block_start: number,
  block_end: number,
  prev_block_hash: IPFSAddress,
) {
  ctx.utils.random = seed_random_str(prev_block_hash);
  const is_root_block = prev_block_hash === AHEAD_OF_ROOT_BLOCK;
  [action_subjects, action_bundle] = sort_n_array(
    [action_subjects, action_bundle],
    (a, b) => a[0] - b[0],
  );

  const low_priority_actions: {
    set_proposal_properties: {
      mid: MID_B58;
      action: ActionSetProposalProperties;
    }[];
    commit_solution: {
      mid: MID_B58;
      action: ActionCommitSolution;
    }[];
    modify_profile: {
      mid: MID_B58;
      action: ActionModifyProfile;
    }[];
    comment: {
      mid: MID_B58;
      action: ActionComment;
    }[];
  } = {
    commit_solution: [],
    modify_profile: [],
    set_proposal_properties: [],
    comment: [],
  };
  for (let i = 0; i < action_subjects.length; ++i) {
    const mid_b58 = action_subjects[i];
    const actions = action_bundle[i];
    if (!simple_validator.validate_actions(actions)) {
      ctx.log('apply_actions:invalid actions');
      continue;
    }

    for (const action of actions) {
      if (action.type === ActionType.InitialAction) {
        if (is_root_block) {
          for (const task of action.tasks) {
            await execute_task(ctx, task);
          }
        }
      }
    }

    if (!(await ctx.db.peer.has(mid_b58))) {
      ctx.log('unknown member');
      continue;
    }

    if ((await ctx.db.peer.get_status(mid_b58)) === PeerStatus.freezed) {
      ctx.log('apply_actions:freezed member');
      continue;
    }

    const actions_map: {
      quit: ActionQuit[];
      freeze_proposal: ActionFreezeProposal[];
      make_proposal: ActionMakeProposal[];
      vote_solution: ActionVoteSolution[];
      withdraw_voting: ActionWithdrawVoting[];
    } = {
      quit: [],
      freeze_proposal: [],
      make_proposal: [],
      vote_solution: [],
      withdraw_voting: [],
    };
    for (const action of actions) {
      if (action.type === ActionType.Quit) {
        actions_map.quit.push(action);
      } else if (action.type === ActionType.Comment) {
        low_priority_actions.comment.push({ mid: mid_b58, action });
      } else if (action.type === ActionType.CommitSolution) {
        low_priority_actions.commit_solution.push({ mid: mid_b58, action });
      } else if (action.type === ActionType.MakeProposal) {
        actions_map.make_proposal.push(action);
      } else if (action.type === ActionType.SetProposalProperties) {
        low_priority_actions.set_proposal_properties.push({
          mid: mid_b58,
          action,
        });
      } else if (action.type === ActionType.ModifyProfile) {
        low_priority_actions.modify_profile.push({ mid: mid_b58, action });
      } else if (action.type === ActionType.WithdrawVoting) {
        actions_map.withdraw_voting.push(action);
      } else if (action.type === ActionType.VoteSolution) {
        actions_map.vote_solution.push(action);
      }
    }

    for (const action of actions_map.quit) {
      // TODO 如果有投票中的或公示中的solution，不能退出
      await ctx.db.peer.remove(mid_b58);
      break;
    }
    for (const action of actions_map.freeze_proposal) {
      const { proposal_id } = action;
      const status = await ctx.db.proposal.get_proposal_status(proposal_id);
      if (status !== ProposalStatus.publicizing) {
        continue;
      }
      await ctx.db.proposal.freeze(proposal_id);
      await ctx.db.peer.freeze(mid_b58);
      // 同一个人在同一周期只能 freeze 一个 proposal
      break;
    }

    for (const action of actions_map.make_proposal) {
      const { proposal } = action;
      let valid = true;
      for (const domain_id of proposal.domain_ids) {
        if (!(await ctx.db.domain.has_domain(domain_id))) {
          valid = false;
          break;
        }
      }
      if (!valid) {
        continue;
      }
      await ctx.db.proposal.add_proposal(
        mid_b58,
        prev_block_hash,
        proposal,
        block_start,
      );
    }

    for (const action of actions_map.withdraw_voting) {
      const { solution_id, proposal_id, conference_id } = action;
      if (!(await ctx.db.proposal.has_solution(solution_id))) {
        continue;
      }
      const status = await ctx.db.proposal.get_proposal_status(proposal_id);
      if (!(await ctx.db.proposal.is_participant(proposal_id, mid_b58))) {
        continue;
      }
      if (
        !(await ctx.db.proposal.has_vote_solution(
          mid_b58,
          conference_id,
          solution_id,
        ))
      ) {
        continue;
      }
      if (
        status === ProposalStatus.discussing_voting ||
        status === ProposalStatus.publicizing // TODO
      ) {
        await ctx.db.proposal.withdraw_voting(
          mid_b58,
          proposal_id,
          conference_id,
          solution_id,
        );
      }
    }
    for (const action of actions_map.vote_solution) {
      const { solution_id, proposal_id, conference_id } = action;
      if (!(await ctx.db.proposal.has_solution(solution_id))) {
        continue;
      }
      const status = await ctx.db.proposal.get_proposal_status(proposal_id);
      if (!(await ctx.db.proposal.is_participant(proposal_id, mid_b58))) {
        continue;
      }
      if (
        status === ProposalStatus.discussing_voting ||
        status === ProposalStatus.publicizing // TODO
      ) {
        await ctx.db.proposal.vote_solution(
          mid_b58,
          proposal_id,
          conference_id,
          solution_id,
        );
      }
    }
  }

  /// 更新 ProposalProperties 并计算 computed_properties
  for (const { mid, action } of [
    ...low_priority_actions.set_proposal_properties,
  ]) {
    const { properties, proposal_id } = action;
    const status = await ctx.db.proposal.get_proposal_status(proposal_id);
    if (status !== ProposalStatus.discussing_voting) {
      continue;
    }
    await ctx.db.proposal.set_proposal_properties(mid, proposal_id, properties);
  }

  for (const { mid, action } of low_priority_actions.commit_solution) {
    const { proposal_id, solution } = action;
    if (!(await ctx.db.proposal.has_proposal(proposal_id))) {
      continue;
    }
    if (!(await ctx.db.proposal.is_participant(proposal_id, mid))) {
      continue;
    }
    await ctx.db.proposal.commit_solution(mid, proposal_id, solution);
  }

  // 结算
  // 更新 proposal status
  const proposal_tasks = await ctx.db.proposal.update_lifecycle(block_end);
  for (const [proposal_id, tasks] of proposal_tasks) {
    for (const task of tasks) {
      await execute_task(ctx, task);
    }
    await ctx.db.proposal.finish(proposal_id);
  }

  // 更新domain
  // 议题激活
  await ctx.db.domain.activate_proposals();

  for (const { mid, action } of low_priority_actions.comment) {
    const { proposal_id, content_cid, solution_id } = action as ActionComment;
    if (solution_id) {
      await ctx.db.proposal.add_solution_comment(mid, solution_id, content_cid);
    } else {
      await ctx.db.proposal.add_proposal_comment(mid, proposal_id, content_cid);
    }
  }

  for (const { mid, action } of low_priority_actions.modify_profile) {
    ctx.db.peer.modify_profile(mid, action.profile);
  }
}

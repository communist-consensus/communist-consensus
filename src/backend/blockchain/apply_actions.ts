import {
  Action,
  ActionComment,
  ActionCommitSolution,
  ActionFreezeProposal,
  ActionMakeProposal,
  ActionModifyProfile,
  ActionQuit,
  ActionSetProposalProperties,
  ActionType,
  ActionVoteSolution,
  Context,
  DBBlock,
  IPFSAddress,
  MassActions,
  NodeID,
  PeerStatus,
  ProposalStatus,
} from '../../../shared/types';
import { seed_random_str, sort_n_array } from '../utils';
import * as simple_validator from '../simple_validator';
import * as peer_store from '../database/peer';
import * as domain_store from '../database/domain';
import * as proposal_store from '../database/proposal';
import { execute_task } from '../virtual-implementer';
import Block from '../database/entity/block';
import { sub_transation } from '../database/utils';
import { EntityManager } from 'typeorm';

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
  manager: EntityManager,
  mass_actions: MassActions,
) {
  const is_root_block = !ctx.prev_block_cid;

  const low_priority_actions: {
    set_proposal_properties: {
      node_id: NodeID;
      action: ActionSetProposalProperties;
    }[];
    commit_solution: {
      node_id: NodeID;
      action: ActionCommitSolution;
    }[];
    modify_profile: {
      node_id: NodeID;
      action: ActionModifyProfile;
    }[];
    comment: {
      node_id: NodeID;
      action: ActionComment;
    }[];
  } = {
    commit_solution: [],
    modify_profile: [],
    set_proposal_properties: [],
    comment: [],
  };
  for (const { node_id, actions } of mass_actions) {
    if (!simple_validator.validate_actions(actions)) {
      ctx.log('apply_actions:invalid actions');
      continue;
    }

    if (is_root_block) {
      for (const action of actions) {
        if (action.type === ActionType.InitialAction) {
          for (const task of action.tasks) {
            await execute_task(ctx, manager, task);
          }
        }
      }
    }

    if (!(await peer_store.has_peer(manager, node_id))) {
      ctx.log('unknown member');
      continue;
    }

    if (
      (await peer_store.get_status(manager, node_id)) === PeerStatus.freezed
    ) {
      ctx.log('apply_actions:freezed member');
      continue;
    }

    const actions_map: {
      quit: ActionQuit[];
      freeze_proposal: ActionFreezeProposal[];
      make_proposal: ActionMakeProposal[];
      vote_solution: ActionVoteSolution[];
    } = {
      quit: [],
      freeze_proposal: [],
      make_proposal: [],
      vote_solution: [],
    };
    for (const action of actions) {
      if (action.type === ActionType.Quit) {
        actions_map.quit.push(action);
      } else if (action.type === ActionType.Comment) {
        low_priority_actions.comment.push({ node_id: node_id, action });
      } else if (action.type === ActionType.CommitSolution) {
        low_priority_actions.commit_solution.push({
          node_id: node_id,
          action,
        });
      } else if (action.type === ActionType.MakeProposal) {
        actions_map.make_proposal.push(action);
      } else if (action.type === ActionType.SetProposalProperties) {
        low_priority_actions.set_proposal_properties.push({
          node_id: node_id,
          action,
        });
      } else if (action.type === ActionType.ModifyProfile) {
        low_priority_actions.modify_profile.push({
          node_id: node_id,
          action,
        });
      } else if (action.type === ActionType.FreezeProposal) {
        actions_map.freeze_proposal.push(action);
      } else if (action.type === ActionType.VoteSolution) {
        actions_map.vote_solution.push(action);
      }
    }

    for (const action of actions_map.quit) {
      // TODO 如果有投票中的或公示中的solution，不能退出
      await peer_store.remove(manager, node_id);
      break;
    }

    let freezed_flag = false;
    for (const action of actions_map.freeze_proposal) {
      const { proposal_uuid: proposal_id } = action;
      const status = await proposal_store.get_proposal_status(
        manager,
        proposal_id,
      );
      if (status !== ProposalStatus.publicizing) {
        continue;
      }
      await proposal_store.freeze(manager, proposal_id);
      await peer_store.freeze(manager, node_id);
      freezed_flag = true;
      // 同一个人在同一周期只能 freeze 一个 proposal
      break;
    }
    if (freezed_flag) {
      continue;
    }

    for (const action of actions_map.make_proposal) {
      const { proposal } = action;
      let valid = true;
      for (const domain_id of proposal.domain_uuids) {
        if (!(await domain_store.has_domain(manager, domain_id))) {
          valid = false;
          break;
        }
      }
      if (!valid) {
        continue;
      }
      await proposal_store.add_proposal(
        manager,
        ctx.N,
        node_id,
        ctx.prev_block_cid,
        proposal,
        ctx.start_timestamp,
      );
    }

    for (const action of actions_map.vote_solution) {
      const {
        solution_uuid: solution_uuid,
        proposal_uuid: proposal_uuid,
        conference_uuid: conference_uuid,
      } = action;
      if (!(await proposal_store.has_solution(manager, solution_uuid))) {
        continue;
      }
      const status = await proposal_store.get_proposal_status(
        manager,
        proposal_uuid,
      );
      if (
        !(await proposal_store.is_participant(manager, proposal_uuid, node_id))
      ) {
        continue;
      }
      if (status === ProposalStatus.discussing_voting) {
        await proposal_store.vote_solution(
          manager,
          node_id,
          proposal_uuid,
          conference_uuid,
          solution_uuid,
        );
      }
    }
  }

  /// 更新 ProposalProperties 并计算 computed_properties
  for (const { node_id, action } of [
    ...low_priority_actions.set_proposal_properties,
  ]) {
    const { properties, proposal_uuid } = action;
    const status = await proposal_store.get_proposal_status(
      manager,
      proposal_uuid,
    );
    if (status !== ProposalStatus.discussing_voting) {
      continue;
    }
    await proposal_store.set_proposal_properties(
      manager,
      ctx.N,
      node_id,
      proposal_uuid,
      properties,
    );
  }

  for (const {
    node_id: node_id,
    action,
  } of low_priority_actions.commit_solution) {
    const { proposal_uuid: proposal_id, solution } = action;
    if (!(await proposal_store.has_proposal(manager, proposal_id))) {
      continue;
    }
    if (!(await proposal_store.is_participant(manager, proposal_id, node_id))) {
      continue;
    }
    await proposal_store.commit_solution(
      manager,
      node_id,
      proposal_id,
      solution,
    );
  }

  // 结算
  // 更新 proposal status
  const proposal_tasks = await proposal_store.update_lifecycle(
    manager,
    ctx.N,
    ctx.start_timestamp + ctx.interval,
  );
  for (const [proposal_id, tasks] of proposal_tasks) {
    for (const task of tasks) {
      await execute_task(ctx, manager, task);
    }
    await proposal_store.finish(manager, proposal_id);
  }

  // 更新domain
  // 议题激活
  await domain_store.activate_proposals(manager);

  for (const { node_id: node_id, action } of low_priority_actions.comment) {
    const {
      proposal_uuid: proposal_id,
      content_cid,
      solution_uuid: solution_id,
    } = action as ActionComment;
    if (solution_id) {
      await proposal_store.add_solution_comment(
        manager,
        node_id,
        solution_id,
        content_cid,
      );
    } else {
      await proposal_store.add_proposal_comment(
        manager,
        node_id,
        proposal_id,
        content_cid,
      );
    }
  }

  for (const { node_id, action } of low_priority_actions.modify_profile) {
    peer_store.modify_profile(manager, node_id, action.profile);
  }
}

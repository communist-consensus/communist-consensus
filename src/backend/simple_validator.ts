// 只检查格式是否符合要求。不检查逻辑的合法性
import {
  VITaskType,
  ActionType,
  IPFSAddress,
  ProposalID,
  SolutionID,
  ActionComment,
  ActionCommitSolution,
  ActionFreezeProposal,
  ActionVoteSolution,
  ActionSetProposalProperties,
  VITask,
  ProposalStatus,
  ActionMakeProposal,
  ProposalProperties,
} from './types';
import { MAX_VI_TASK_DEPTH } from './constant';
import {
  Action,
  ActionInitialAction,
  ActionModifyProfile,
  ActionQuit,
  Actions,
  CommonProposal,
  CommonSolution,
  DBBlock,
  ModifiableProfile,
  VIAssignToEntity,
} from '../../shared/types';
import { TITLE_LENGTH } from '../../shared/constant';

const db_block_keys = new Set<keyof DBBlock>([
  'block_cid',
  'start_timestamp',
  'epoch',
  'mass_actions',
  'prev_block_cid',
  'aba_proofs',
  'rbc_proofs',
]);
const action_initial_action_keys = new Set<keyof ActionInitialAction>([
  'tasks',
  'type',
]);

const action_modifiable_profile_keys = new Set<keyof ModifiableProfile>([
  'proof_cid',
]);

const action_modify_profile_keys = new Set<keyof ActionModifyProfile>([
  'type',
  'profile',
]);
const vitask_assign_to_entity_keys = new Set<keyof VIAssignToEntity>([
  'type',
  'mid',
]);
const proposal_properties_keys = new Set<keyof ProposalProperties>([
  'discussion_voting_duration',
  'max_n_proposer',
]);
const action_set_proposal_properties_keys = new Set<
  keyof ActionSetProposalProperties
>(['type', 'proposal_uuid', 'properties']);
const action_vote_solution_keys = new Set<keyof ActionVoteSolution>([
  'type',
  'solution_uuid',
]);
const solution_keys = new Set<keyof CommonSolution>(['tasks', 'content_cid']);
const action_make_proposal_keys = new Set<keyof ActionMakeProposal>([
  'proposal',
  'type',
]);
const proposal_keys = new Set<keyof CommonProposal>([
  'title',
  'content_cid',
  'default_solution',
  'domain_uuids',
  'properties',
]);
const action_quit_keys = new Set<keyof ActionQuit>(['type']);
const action_commit_solution_keys = new Set<keyof ActionCommitSolution>([
  'type',
  'proposal_uuid',
  'solution',
]);
const action_freeze_proposal_keys = new Set<keyof ActionFreezeProposal>([
  'proposal_uuid',
  'type',
  'content_cid',
]);

export function validate_integer(n: number) {
  return typeof n === 'number' && n % 1 === 0;
}

export function validate_non_negative_integer(n: number) {
  return validate_integer(n) && n >= 0;
}

export function validate_positive_integer(n: number) {
  return validate_integer(n) && n > 0;
}

export function validate_timestamp(time: number) {
  return validate_non_negative_integer(time);
}

export function validate_initial_action(action: ActionInitialAction) {
  return (
    typeof action === 'object' &&
    Object.keys(action).length === action_initial_action_keys.size &&
    action.type === ActionType.InitialAction &&
    validate_tasks(action.tasks)
  );
}

export function validate_action(action: Action) {
  if (typeof action !== 'object') {
    return false;
  }
  if (action.type === ActionType.Comment) {
    return validate_comment(action);
  } else if (action.type === ActionType.InitialAction) {
    return validate_initial_action(action);
  } else if (action.type === ActionType.CommitSolution) {
    return validate_commit_solution(action);
  } else if (action.type === ActionType.FreezeProposal) {
    return validate_freeze_proposal(action);
  } else if (action.type === ActionType.MakeProposal) {
    return validate_make_proposal(action);
  } else if (action.type === ActionType.Quit) {
    return validate_quit(action);
  } else if (action.type === ActionType.SetProposalProperties) {
    return validate_set_proposal_properties(action);
  } else if (action.type === ActionType.ModifyProfile) {
    return validate_modify_profile(action);
  } else if (action.type === ActionType.VoteSolution) {
    return validate_vote_solution(action);
  }
  return false;
}

export function validate_modify_profile(action: ActionModifyProfile) {
  if (
    typeof action === 'object' &&
    action.type === ActionType.ModifyProfile &&
    match_keys(action_modify_profile_keys, action)
  ) {
    return validate_modifiable_profile(action.profile);
  }
  return false;
}

export function validate_modifiable_profile(profile: ModifiableProfile) {
  if (typeof profile === 'object') {
    for (const i of Object.keys(profile)) {
      if (!action_modifiable_profile_keys.has(i as keyof ModifiableProfile)) {
        return false;
      }
      if ((i as keyof ModifiableProfile) === 'proof_cid') {
        if (!validate_IPFS_address(profile.proof_cid)) {
          return false;
        }
      }
    }
    return true;
  }
  return false;
}

export function validate_mid(mid: string) {
  return (
    typeof mid === 'string' && mid.length > 0 && /^[a-zA-Z0-9]+$/.test(mid)
  );
}

export function validate_name(name: string) {
  return typeof name === 'string' && name.length > 0 && name.length < 32;
}

export function validate_quit(action: ActionQuit) {
  return (
    typeof action === 'object' &&
    action.type === ActionType.Quit &&
    Object.keys(action).length === action_quit_keys.size
  );
}

export function validate_actions(actions: Actions) {
  if (!(actions instanceof Array)) {
    return false;
  }
  if (actions.length > 1000) {
    return false;
  }
  for (const action of actions) {
    if (!validate_action(action)) {
      return false;
    }
  }
  return true;
}

export function validate_make_proposal(action: ActionMakeProposal) {
  return (
    typeof action === 'object' &&
    Object.keys(action).length === action_make_proposal_keys.size &&
    validate_proposal(action.proposal)
  );
}

export function validate_title(title: string) {
  return typeof title === 'string' && title.length <= TITLE_LENGTH;
}

export function validate_proposal(proposal: CommonProposal) {
  return (
    typeof proposal === 'object' &&
    Object.keys(proposal).length === proposal_keys.size &&
    validate_title(proposal.title) &&
    validate_IPFS_address(proposal.content_cid) &&
    validate_solution(proposal.default_solution) &&
    validate_proposal_properties(proposal.properties) &&
    validate_ids(proposal.domain_uuids)
  );
}

export function validate_ids(ids: string[]) {
  return ids instanceof Array && ids.length;
}

export function validate_proposal_properties(properties: ProposalProperties) {
  return (
    typeof properties === 'object' &&
    Object.keys(properties).length === proposal_properties_keys.size &&
    validate_n_participant(properties.max_n_proposer) &&
    validate_duration(properties.discussion_voting_duration)
  );
}

export function validate_n_participant(n: number) {
  return validate_non_negative_integer(n) && n >= 1 && n <= 10000;
}

export function validate_rate(r: number) {
  return r >= 0 && r <= 1;
}

export function validate_proposal_properties_partial(
  properties: Partial<ProposalProperties>,
) {
  if (typeof properties !== 'object') {
    return false;
  }
  const set = proposal_properties_keys;
  const p_keys = Object.keys(properties) as (keyof ProposalProperties)[];
  for (let i = 0; i < p_keys.length; ++i) {
    if (set.has(p_keys[i]) && properties[p_keys[i]] >= 0) {
      continue;
    } else {
      return false;
    }
  }
  if (
    properties.max_n_proposer !== undefined &&
    !validate_n_participant(properties.max_n_proposer)
  ) {
    return false;
  }
  if (
    properties.discussion_voting_duration !== undefined &&
    !validate_duration(properties.discussion_voting_duration)
  ) {
    return false;
  }
  return true;
}

export function validate_solution(solution: CommonSolution) {
  return (
    typeof solution === 'object' &&
    Object.keys(solution).length === solution_keys.size &&
    validate_IPFS_address(solution.content_cid) &&
    validate_tasks(solution.tasks)
  );
}

export function validate_aes_key(aes: string) {
  return typeof aes === 'string' && aes.length === 32;
}

export function validate_tasks(tasks: VITask[]) {
  if (!(tasks instanceof Array)) {
    return false;
  }
  if (tasks.length >= MAX_VI_TASK_DEPTH) {
    return false;
  }
  for (const i of tasks) {
    if (!validate_task(i)) {
      return false;
    }
  }
  return true;
}

export function validate_set_proposal_properties(
  action: ActionSetProposalProperties,
) {
  return (
    typeof action === 'object' &&
    action.type === ActionType.SetProposalProperties &&
    Object.keys(action).length === action_set_proposal_properties_keys.size &&
    validate_id(action.proposal_uuid) &&
    validate_proposal_properties_partial(action.properties)
  );
}

export function validate_vote_solution(action: ActionVoteSolution) {
  return (
    typeof action === 'object' &&
    Object.keys(action).length === action_vote_solution_keys.size &&
    action.type === ActionType.VoteSolution &&
    validate_id(action.solution_uuid)
  );
}

export function validate_freeze_proposal(action: ActionFreezeProposal) {
  return (
    typeof action === 'object' &&
    Object.keys(action).length === action_freeze_proposal_keys.size &&
    action.type === ActionType.FreezeProposal &&
    validate_id(action.proposal_uuid)
  );
}

export function validate_commit_solution(action: ActionCommitSolution) {
  return (
    typeof action === 'object' &&
    Object.keys(action).length === action_commit_solution_keys.size &&
    action.type === ActionType.CommitSolution &&
    validate_id(action.proposal_uuid) &&
    validate_solution(action.solution)
  );
}

export function validate_comment(action: ActionComment) {
  if (typeof action.content_cid !== 'string') {
    return false;
  }
  if (action.proposal_uuid && !validate_id(action.proposal_uuid)) {
    return false;
  }
  if (action.solution_uuid && !validate_id(action.solution_uuid)) {
    return false;
  }
  if (action.proposal_uuid && action.solution_uuid) {
    return false;
  }
  if (Object.keys(action).length !== 4) {
    return false;
  }
  return action.type === ActionType.Comment;
}

export function validate_proposal_status(status: ProposalStatus) {
  return validate_positive_integer(status) && status >= 1 && status <= 1000;
}

export function validate_task_type(type: VITaskType) {
  return validate_positive_integer(type) && type >= 1 && type <= 1000;
}

export function validate_id(id: SolutionID | ProposalID | IPFSAddress<any>) {
  return typeof id === 'string' && id.length <= 128 && id.length >= 3;
}

// ms
export function validate_duration(duration: number) {
  return (
    validate_positive_integer(duration) && duration < 1000 * 60 * 60 * 24 * 365
  );
}

function match_keys(set: Set<any>, obj: { [key: string]: any }) {
  if (Object.keys(obj).length !== set.size) {
    return false;
  }
  for (const i of Object.keys(obj)) {
    if (!set.has(i)) {
      return false;
    }
  }
  return true;
}

export function validate_script(s: string) {
  return validate_string(s) && s.length < 3000;
}

export function validate_task(task: VITask) {
  if (typeof task !== 'object') {
    return false;
  }
  if (!validate_task_type(task.type)) {
    return false;
  }
  // TODO
  if (task.type === VITaskType.AssignToEntity) {
    return (
      match_keys(vitask_assign_to_entity_keys, task) && validate_mid(task.mid)
    );
  } else if (task.type === VITaskType.DomainAdd) {
    // TODO
    return true;
  } else if (task.type === VITaskType.DomainMerge) {
  } else if (task.type === VITaskType.DomainModify) {
  } else if (task.type === VITaskType.PeerAdd) {
  } else if (task.type === VITaskType.PeerDelete) {
  } else if (task.type === VITaskType.Upgrade) {
    return validate_script(task.script);
  } else if (task.type === VITaskType.RevokeProposal) {
  } else {
    return false;
  }
  return true;
}

export function validate_boolean(x: boolean) {
  return typeof x === 'boolean';
}

export function validate_IPFS_address(x: string) {
  // TODO
  if (typeof x !== 'string') {
    return false;
  }
  if (x.length > 128 || x.length < 3) {
    return false;
  }
  return true;
}

export function validate_db_block(block: DBBlock) {
  return (
    typeof block === 'object' &&
    Object.keys(block).length === db_block_keys.size &&
    validate_IPFS_address(block.block_cid) &&
    validate_IPFS_address(block.prev_block_cid) &&
    validate_IPFS_address(block.aba_proofs) &&
    validate_IPFS_address(block.rbc_proofs) &&
    validate_integer(block.epoch)
  );
}

export function validate_string(x: string) {
  return typeof x === 'string';
}

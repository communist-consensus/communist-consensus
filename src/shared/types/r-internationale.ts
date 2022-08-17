import { Signature } from 'typescript';
import { RIConfig } from '.';
import { IPFSAddress, MID_B58 } from './common';

export type ProposalID = string;
export type SolutionID = string;
export type VITaskID = string;
export type DomainID = string;
export type ConferenceID = string;

export type BlockTimestamps = {
  actions_broadcast_window_start: number;
  actions_broadcast_window_end: number;
  witness_broadcast_window_start: number;
  witness_broadcast_window_end: number;
}
export type BlockchainBlock = {
  prev_block_hash: IPFSAddress;
  action_bundle_cid: IPFSAddress,
  action_subjects_cid: IPFSAddress,
  action_signatures_cid: IPFSAddress,
  n_peer: number,
} & BlockTimestamps;
export type ActionSubject = MID_B58;
export type ActionSubjects = ActionSubject[];
export type Actions = Action[];
export type ActionBundle = Actions[];
export type ActionsTestimony = {
  before_prev_block_hash: IPFSAddress,
  start_timestamp: number, // current block
  actions: Actions,
  mid: MID_B58,
};

/**
 * Signature of ActionsTestimony
 */
export type ActionSignature = Uint8Array;
export type ActionSignatures = ActionSignature[];
export type Witness = MID_B58;
export type Witnesses = Witness[];
export type WitnessTestimonyCIDs = IPFSAddress[];
export type WitnessTestimony = {
  prev_block_hash: IPFSAddress;
  min_witness_broadcast_window: number;
  min_actions_broadcast_window: number;
  n_tries: number;
  action_bundle_cid: IPFSAddress;
  action_signatures_cid: IPFSAddress;
  action_subjects_cid: IPFSAddress;
} & BlockTimestamps;
/**
 * Signature of WitnessTestimony
 */
export type WitnessSignature = Uint8Array;
export type WitnessSignatures = WitnessSignature[];

export enum RIPeerEvent {
  internal_final_witness_testimony_cid = 'internal_final_witness_testimony_cid',

  internal_actions_broadcast_start = 'internal_actions_broadcast_start',
  internal_witness_broadcast_start = 'internal_witness_broadcast_start',

  actions_broadcast_start = 'actions_broadcast_start',
  witness_broadcast_start = 'witness_broadcast_start',
  witness_broadcast_start_finished = 'witness_broadcast_start_finished',
  before_actions_broadcast = 'before_actions_broadcast',
  actions_broadcast_end = 'actions_broadcast_end',
  witness_broadcast_before_end = 'witness_broadcast_before_end',
  witness_broadcast_end = 'witness_broadcast_end',
  witness_broadcast_retry = 'witness_broadcast_retry',

  tasks_before_executed = 'tasks_before_execute',
  proposals_before_activated = 'proposals_before_activated',

  proposal_status_changed = 'proposal_status_changed',

  after_apply_actions = 'after_apply_actions',
}
export enum BlockCtxState {
  inactive,
  actions_broadcast_start,
  actions_broadcast_end,
  witness_broadcast_start,
  witness_broadcast_end,
}

export type BlockContext = {
  min_witness_broadcast_window: number;
  min_actions_broadcast_window: number;
  block_hash: IPFSAddress;
  prev_block_hash: IPFSAddress;
  n_tries: number;
  cycle_id: number;
  actions_broadcasted: boolean;
  actions_broadcast_timestamp: number;
  witness_broadcast_timestamp: number;
  actions_broadcast_window_start: number;
  actions_broadcast_window_end: number;
  witness_broadcast_window_start: number;
  witness_broadcast_window_end: number;
  state: BlockCtxState;
  actions: Actions;
  action_bundle: ActionBundle;
  action_bundle_cid: IPFSAddress;
  action_signatures: ActionSignatures;
  action_signatures_cid: IPFSAddress;
  action_subjects: ActionSubjects;
  action_subjects_cid: IPFSAddress;
  final_witnesses_cid: IPFSAddress;
  final_witness_testimony_cid: IPFSAddress;
  final_witness_signatures_cid: IPFSAddress;
  // 该区块运行前的 n_peer，ab期间的n_peer与wb期间的n_peer可能不同（都是取前一个刚确认的区块的n_peer)
  n_peer: number;
  next?: BlockContext;
  prev?: BlockContext;

  witnesses: MID_B58[];
  witness_signatures: WitnessSignatures;
  witness_testimony_cids: IPFSAddress[];

  temp_signature_for_final_witness_testimony_cid: Uint8Array;
  temp_signature_cid: IPFSAddress;
};

export enum ConferenceStatus {
  invalid,
  ready,
  done,
}

export enum ProposalStatus {
  invalid = 1, // 投票率过低
  failed,
  done,
  freezed,
  inactivated,
  executing,
  publicizing,
  discussing_voting,
}

export enum VITaskType {
  SelfUpgrade = 1,
  DomainAdd,
  DomainMerge,
  DomainModify,
  PeerAdd,
  PeerDelete,
  RevokeProposal,
  AssignToEntity = 1000,
}
export type VITaskBasic = {
  type: VITaskType;
};
export type VIRevokeProposal = VITaskBasic & {
  type: VITaskType.RevokeProposal;
  proposal_id: ProposalID;
};
export type VISelfUpgrade = VITaskBasic & {
  type: VITaskType.SelfUpgrade;
  script: string;
};
export type VIDomainMerge = VITaskBasic & {
  type: VITaskType.DomainMerge;
  domain_id: DomainID;
  target_domain_id: DomainID;
};
export type VIDomainAdd = VITaskBasic & {
  type: VITaskType.DomainAdd;
  name: string;
  supported_types: VITaskType[]; // 领域下支持的任务类型
  parent_domain_id?: DomainID; // 为空表示顶级领域
};
export type VIDomainModify = VITaskBasic & {
  type: VITaskType.DomainModify;
  domain_id: DomainID;
  name?: string;
  supported_types?: VITaskType[]; // 领域下支持的任务类型
};
export type VIPeerAdd = VITaskBasic & {
  type: VITaskType.PeerAdd;
  profile: Profile;
};
export type VIPeerDelete = VITaskBasic & {
  type: VITaskType.PeerDelete;
  mid: MID_B58;
};
export type VIAssignToEntity = VITaskBasic & {
  type: VITaskType.AssignToEntity;
  mid: string;
};
export type VITask =
  | VIRevokeProposal
  | VISelfUpgrade
  | VIDomainAdd
  | VIDomainMerge
  | VIDomainModify
  | VIPeerAdd
  | VIPeerDelete
  | VIAssignToEntity;

export type CommonSolution = {
  content_cid: IPFSAddress;
  tasks: VITask[];
};

export type ProposalProperties = {
  discussion_voting_duration: number; // 会议讨论持续时间 秒
  max_n_proposer: number; // 单个会议（子会议）最大参与人数
};

export type CommonProposal = {
  title: string;
  content_cid: IPFSAddress;
  default_solution: CommonSolution;
  properties: ProposalProperties;
  domain_ids: DomainID[];
};
export type Comment = { mid: MID_B58; content_cid: IPFSAddress };
export type Votes = Set<MID_B58>;
export enum PeerStatus {
  active,
  freezed,
}

export type Domain = {
  name: string;
  // support_types: VIDomainType[];
  sub_domain: Domain[];
};

export enum ActionType {
  MakeProposal = 1,
  CommitSolution,
  Comment,
  VoteSolution,
  WithdrawVoting,
  Quit,
  SetProposalProperties,
  ModifyProfile,
  InitialAction,
  FreezeProposal = 1000,
}

export type ActionWithdrawVoting = {
  type: ActionType.WithdrawVoting;
  proposal_id: ProposalID;
  conference_id: ConferenceID;
  solution_id: SolutionID;
};
export type ActionMakeProposal = {
  type: ActionType.MakeProposal;
  proposal: CommonProposal;
};
// 参与议题 -> 对方案投票
export type ActionVoteSolution = {
  type: ActionType.VoteSolution;
  proposal_id: ProposalID;
  solution_id: SolutionID;
  conference_id: ConferenceID;
};
// 参与议题 -> 提出方案
export type ActionCommitSolution = {
  type: ActionType.CommitSolution;
  proposal_id: ProposalID;
  solution: CommonSolution;
};
export type ActionFreezeProposal = {
  type: ActionType.FreezeProposal;
  proposal_id: ProposalID;
  content_cid: IPFSAddress;
};
// 参与议题 -> 评论方案
export type ActionComment = {
  type: ActionType.Comment;
  proposal_id: ProposalID;
  solution_id?: SolutionID;
  content_cid: IPFSAddress;
};
export type ActionQuit = {
  type: ActionType.Quit;
};
export type ActionSetProposalProperties = {
  type: ActionType.SetProposalProperties;
  proposal_id: ProposalID;
  properties: Partial<ProposalProperties>;
};

export type ModifiableProfile = {
  proof_cid?: IPFSAddress; // 详细档案和证明
};
export type Profile = {
  public_key: string;
  name: string;
  proof_cid: IPFSAddress; // 详细档案和证明
};
export type ActionModifyProfile = {
  type: ActionType.ModifyProfile;
  profile: ModifiableProfile;
};

export type ActionInitialAction = {
  type: ActionType.InitialAction;
  tasks: VITask[];
};

export type Action = ActionInitialAction | ActionWithdrawVoting | ActionModifyProfile | ActionFreezeProposal | ActionComment | ActionSetProposalProperties | ActionQuit | ActionMakeProposal | ActionVoteSolution | ActionCommitSolution;

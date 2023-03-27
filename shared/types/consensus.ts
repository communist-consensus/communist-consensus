import { IPFSAddress,NodeID  } from './common';

export type ProposalID = string;
export type SolutionID = string;
export type VITaskID = string;
export type DomainID = string;
export type ConferenceID = string;

export type ActionSubject = NodeID;
export type ActionSubjects = ActionSubject[];
export type Actions = Action[];
export type ActionBundle = Actions[];
export type ActionsTestimony = {
  before_prev_block_hash: IPFSAddress;
  start_timestamp: number; // current block
  actions: Actions;
  node_id: NodeID;
};

export enum ConsensusEvent {
  tasks_before_executed = 'tasks_before_execute',
  proposals_before_activated = 'proposals_before_activated',
  proposal_status_changed = 'proposal_status_changed',
  after_apply_actions = 'after_apply_actions',
}

export type BlockContext = {
  epoch: number;
  block_hash: IPFSAddress;
  prev_block_hash: IPFSAddress;
  n_tries: number;
  actions: Actions;
  action_bundle: ActionBundle;
  action_bundle_cid: IPFSAddress;
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
  mid: NodeID;
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
export type Comment = { mid: NodeID; content_cid: IPFSAddress };
export type Votes = Set<NodeID>;
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

export type Action =
  | ActionInitialAction
  | ActionWithdrawVoting
  | ActionModifyProfile
  | ActionFreezeProposal
  | ActionComment
  | ActionSetProposalProperties
  | ActionQuit
  | ActionMakeProposal
  | ActionVoteSolution
  | ActionCommitSolution;

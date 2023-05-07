import { IPFSAddress,NodeID  } from './common';
import { ProposalContent, SolutionContent } from './database';

export type ProposalID = string;
export type SolutionID = string;
export type VITaskID = string;
export type DomainID = string;
export type ConferenceID = string;

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
  Upgrade = 1,
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
  proposal_uuid: ProposalID;
};
export type VISelfUpgrade = VITaskBasic & {
  type: VITaskType.Upgrade;
  script: string;
};
export type VIDomainMerge = VITaskBasic & {
  type: VITaskType.DomainMerge;
  domain_uuid: DomainID;
  target_domain_uuid: DomainID;
};
export type VIDomainAdd = VITaskBasic & {
  type: VITaskType.DomainAdd;
  name: string;
  supported_types: VITaskType[]; // 领域下支持的任务类型
  parent_domain_uuid?: DomainID; // 为空表示顶级领域
};
export type VIDomainModify = VITaskBasic & {
  type: VITaskType.DomainModify;
  domain_uuid: DomainID;
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
  content_cid: IPFSAddress<SolutionContent>;
  tasks: VITask[];
};

export type ProposalProperties = {
  discussion_voting_duration: number; // 会议讨论持续时间 秒
  max_n_proposer: number; // 单个会议（子会议）最大参与人数
};

export type CommonProposal = {
  title: string;
  content_cid: IPFSAddress<ProposalContent>;
  default_solution: CommonSolution;
  properties: ProposalProperties;
  domain_uuids: DomainID[];
};
export type Comment = { mid: NodeID; content_cid: IPFSAddress<string> };
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
  Quit,
  SetProposalProperties,
  ModifyProfile,
  InitialAction,
  FreezeProposal = 1000,
}

export type ActionMakeProposal = {
  type: ActionType.MakeProposal;
  proposal: CommonProposal;
};
// 参与议题 -> 对方案投票
export type ActionVoteSolution = {
  type: ActionType.VoteSolution;
  proposal_uuid: ProposalID;
  solution_uuid: SolutionID;
  conference_uuid: ConferenceID;
};
// 参与议题 -> 提出方案
export type ActionCommitSolution = {
  type: ActionType.CommitSolution;
  proposal_uuid: ProposalID;
  solution: CommonSolution;
};
export type ActionFreezeProposal = {
  type: ActionType.FreezeProposal;
  proposal_uuid: ProposalID;
  content_cid: IPFSAddress<string>;
};
// 参与议题 -> 评论方案
export type ActionComment = {
  type: ActionType.Comment;
  proposal_uuid: ProposalID;
  solution_uuid?: SolutionID;
  content_cid: IPFSAddress<string>;
};
export type ActionQuit = {
  type: ActionType.Quit;
};
export type ActionSetProposalProperties = {
  type: ActionType.SetProposalProperties;
  proposal_uuid: ProposalID;
  properties: Partial<ProposalProperties>;
};

export type ModifiableProfile = {
  proof_cid?: IPFSAddress<string>; // 详细档案和证明
};

export enum RBCProtocolStage {
  RBC_READY = 'RBC_READY',
  RBC_ECHO = 'RBC_ECHO',
  RBC_VAL = 'RBC_VAL',
}
export enum ABAProtocolStage {
  ABA_PREVOTE = 'ABA_PREVOTE',
  ABA_VOTE = 'ABA_VOTE',
  ABA_MAINVOTE = 'ABA_MAINVOTE',
  ABA_FINALVOTE = 'ABA_FINALVOTE',
  ABA_DECIDED = 'ABA_DECIDED',
}

export type RBCProtocols = keyof typeof RBCProtocolStage;
export type ABAProtocols = keyof typeof ABAProtocolStage;
export type SubProtocols = RBCProtocols | ABAProtocols;

export type Profile = {
  public_key: string;
  name: string;
  proof_cid: IPFSAddress<string>; // 详细档案和证明
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
  | ActionModifyProfile
  | ActionFreezeProposal
  | ActionComment
  | ActionSetProposalProperties
  | ActionQuit
  | ActionMakeProposal
  | ActionVoteSolution
  | ActionCommitSolution;

export type Actions = Action[];
export type MassActions = { node_id: NodeID; actions: Actions }[];
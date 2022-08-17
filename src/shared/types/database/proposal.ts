import EventEmitter from 'events';
import { IPFSAddress, MID_B58 } from '../common';
import { CommonProposal, CommonSolution, ConferenceID, ConferenceStatus, Domain, DomainID, PeerStatus, ProposalID, ProposalProperties, ProposalStatus, SolutionID, VITask, VITaskType } from '../r-internationale';

export type DBTask = {
  id: string;
  type: VITaskType;
  args: Uint8Array;
}

export type DBSolution = {
  id: string;

  peer_id: string;

  content_cid: IPFSAddress;
}

export type DBProposal = {
  id: string;
  prev_block_hash: IPFSAddress;

  content_cid: IPFSAddress;

  title: string;
  computed_latest_conference_id: string;

  originator_id: string;

  status: ProposalStatus;

  computed_n_round: number;

  computed_n_participant: number;

  computed_discussion_voting_duration: number;
  computed_max_n_proposer: number;

  accumulated_discussion_voting_duration: number;
  accumulated_max_n_proposer: number;

  make_proposal_timestamp: number;
  computed_discussion_voting_end: number;
  computed_publicity_end: number;

  computed_final_solution_id: string;
  computed_final_conference_id: string;
};
export type DBSolutionComment = {

  id: number;

  content_cid: IPFSAddress;

  solution_id: string;

  peer_id: string;
};
export type ExtendedSolution = {
  solution: DBSolution;
  comments: DBSolutionComment[];
  tasks: DBTask[];
};
export type DBConference = {
  id: string;

  status: ConferenceStatus;

  round_id: number;

  proposal_id: string;

  computed_n_proposer: number;

  computed_max_n_vote: number;
};
export type DBConferenceSolutionPair = {
  id: number;
  solution_id: string;
  round_id: number;
  conference_id: string;
}
export interface IDBProposal {
  get_solution: (solution_id: SolutionID) => Promise<ExtendedSolution>;
  get_proposal_status: (proposal_id: ProposalID) => Promise<ProposalStatus>;
  get_votes: (
    proposal_id: ProposalID,
    conference_id: ConferenceID,
    solution_id: SolutionID,
  ) => Promise<number>;

  get_which_conference: (
    proposal_id: ProposalID,
    n_round: number,
    mid: MID_B58,
  ) => Promise<ConferenceID>;
  get_conferences: (
    proposal_id: ProposalID,
    round_id: number,
    page: number,
    n?: number,
  ) => Promise<DBConference[]>;
  get_conference_solutions: (
    proposal_id: ProposalID,
    round_id: number,
    conference_id: ConferenceID,
    page: number,
    n?: number,
  ) => Promise<DBConferenceSolutionPair[]>;

  get_proposal: (proposal_id: ProposalID) => Promise<DBProposal>;

  is_participant: (proposal_id: ProposalID, mid: MID_B58) => Promise<boolean>;
  has_solution: (solution_id: SolutionID) => Promise<boolean>;
  has_proposal: (proposal_id: ProposalID) => Promise<boolean>;
  add_proposal: (
    mid: MID_B58,
    prev_block_hash: IPFSAddress,
    proposal: CommonProposal,
    timestamp: number,
  ) => Promise<void>;
  has_vote_solution: (
    mid: MID_B58,
    conference_id: string,
    solution_id: SolutionID,
  ) => Promise<boolean>;
  commit_solution: (
    mid_b58: MID_B58,
    proposal_id: ProposalID,
    solution: CommonSolution,
  ) => Promise<void>;
  withdraw_voting: (
    mid: MID_B58,
    proposal_id: ProposalID,
    conference_id: string,
    solution_id: SolutionID,
  ) => Promise<void>;
  vote_solution: (
    mid: MID_B58,
    proposal_id: ProposalID,
    conference_id: string,
    solution_id: SolutionID,
  ) => Promise<void>;
  freeze: (proposal_id: ProposalID) => Promise<void>;
  set_proposal_properties: (
    mid: MID_B58,
    proposal_id: ProposalID,
    properties: Partial<ProposalProperties>,
  ) => Promise<void>;
  update_lifecycle: (
    block_end_timestamp: number,
  ) => Promise<Map<ProposalID, VITask[]>>;
  add_solution_comment: (
    mid: MID_B58,
    solution_id: SolutionID,
    content_cid: IPFSAddress,
  ) => Promise<void>;
  add_proposal_comment: (
    mid: MID_B58,
    proposal_id: ProposalID,
    content_cid: IPFSAddress,
  ) => Promise<void>;

  activate: (proposal_id: ProposalID) => Promise<void>;
  finish: (proposal_id: ProposalID) => Promise<void>;
}
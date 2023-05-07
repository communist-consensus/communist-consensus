import EventEmitter from 'events';
import { IPFSAddress, NodeID } from '../common';
import {
  CommonProposal,
  CommonSolution,
  ConferenceID,
  ConferenceStatus,
  Domain,
  DomainID,
  PeerStatus,
  ProposalID,
  ProposalProperties,
  ProposalStatus,
  SolutionID,
  VITask,
  VITaskType,
} from '../consensus';
import { DBBlock } from './block';
import { EntityManager } from 'typeorm';

export type DBTask = {
  uuid: string;
  type: VITaskType;
  args: Uint8Array;
};

export type SolutionContent = string;
export type ProposalContent = string;

export type DBSolution = {
  uuid: string;

  peer_uuid: string;

  content_cid: IPFSAddress<SolutionContent>;
};

export type DBProposal = {
  uuid: string;
  prev_block_cid: IPFSAddress<DBBlock>;

  content_cid: IPFSAddress<ProposalContent>;

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
  uuid: string;

  content_cid: IPFSAddress<string>;

  solution_uuid: string;

  peer_uuid: string;
};
export type ExtendedSolution = {
  solution: DBSolution;
  comments: DBSolutionComment[];
  tasks: DBTask[];
};
export type DBConference = {
  uuid: string;

  status: ConferenceStatus;

  round_id: number;

  proposal_uuid: string;

  computed_n_proposer: number;

  computed_max_n_vote: number;
};
export type DBConferenceSolutionPair = {
  uuid: number;
  solution_uuid: string;
  round_id: number;
  conference_uuid: string;
};

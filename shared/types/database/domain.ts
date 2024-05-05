import { EntityManager } from 'typeorm';
import { IPFSAddress, NodeID } from '../common';
import {
  CommonProposal,
  Domain,
  DomainID,
  PeerStatus,
  ProposalID,
  ProposalProperties,
  ProposalStatus,
  SolutionID,
} from '../consensus';

export interface DBDomain {
  name: string;
  uuid: string;
  parent_uuid: string;
}

export type DBDomainProposalPair = {
  uuid: string;
  domain_uuid: string;
  proposal_uuid: string;
  proposal_status: ProposalStatus;
  computed_n_participant: number;
};

import { IPFSAddress, MID_B58 } from '../common';
import { CommonProposal, Domain, DomainID, PeerStatus, ProposalID, ProposalProperties, ProposalStatus, SolutionID } from '../r-internationale';

export interface DomainEntity {
  name: string;
  id: string;
  parent_id: string;
};

export type DBDomainProposalPair = {
  id: number;
  domain_id: string;
  proposal_id: string;
  proposal_status: ProposalStatus;
  computed_n_participant: number;
};

export interface IDBDomain {
  get_domain_top: (domain_id: DomainID) => Promise<ProposalID>;
  add_domain: (domain_id: DomainID, domain: Domain, parent_id?: DomainID) => Promise<void>;
  has_domain: (domain_id: DomainID) => Promise<boolean>;
  proposal_is_in_domain: (
    proposal_id: ProposalID,
    domain_id: DomainID,
  ) => Promise<boolean>;
  activate_proposals: () => Promise<void>;
  get_domains: (page: number, n?: number) => Promise<{
    domains: DomainEntity[],
    total: number,
    n: number,
  }>;
  get_sub_domains: (domain_id: DomainID, page: number, n?: number) => Promise<{
    domains: DomainEntity[],
    total: number,
    n: number,
  }>;
  get_proposals: (domain_id: DomainID, page: number, n?: number) => Promise<{
    proposals: {
      proposal_id: ProposalID,
      proposal_status: ProposalStatus,
      computed_n_participant: number,
    }[],
    total: number,
    n: number,
  }>;
}
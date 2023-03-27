import { IDBDomain, Domain, DomainID, ProposalID } from '../types';
import { ProposalStatus } from '../../../shared/types';
import DomainEntity from './entity/domain';
import DomainProposalPair from './entity/domain-proposal-pair';
import { EntityManager, Not } from 'typeorm';

export default (manager: EntityManager): IDBDomain => ({
  async rename_domain(domain_id: DomainID, name: string) {
    await manager.update(DomainEntity, { id: domain_id }, { name });
  },

  /**
   * domain_id 合并到 target_domain_id
   */
  async merge_domain(target_domain_id: DomainID, domain_id: DomainID) {
    // TODO
  },

  async has_domain(domain_id: DomainID) {
    return !!(await manager.count(DomainEntity, {
      id: domain_id,
    }));
  },

  async proposal_is_in_domain(proposal_id: ProposalID, domain_id: DomainID) {
    return !!(await manager.count(DomainProposalPair, {
      domain_id,
      proposal_id,
    }));
  },

  async get_domain_top(domain_id: DomainID) {
    const pair = await manager.findOne(DomainProposalPair, {
      where: {
        domain_id,
        proposal_status: Not(ProposalStatus.done),
      },
      order: {
        computed_n_participant: 'DESC',
      },
    });
    return pair ? pair.proposal_id : undefined;
  },

  async add_domain(
    domain_id: DomainID,
    domain: Domain,
    parent_id: DomainID = '',
  ) {
    await manager.insert(DomainEntity, {
      id: domain_id,
      name: domain.name,
      parent_id,
    });
  },

  async activate_proposals() {
    const domains = await manager.find(DomainEntity);
    // TODO
    for (const domain of domains) {
      const top = await this.get_domain_top(domain.id);
      if (top) {
        const status = await this.db.proposal.get_proposal_status(top);
        if (status === ProposalStatus.inactivated) {
          await this.db.proposal.activate(top);
        }
      }
    }
  },

  async get_domain(domain_id: DomainID) {
    return await manager.findOne(DomainEntity, domain_id);
  },

  async get_sub_domains(domain_id: string, page: number, n = 20) {
    const [domains, total] = await manager.findAndCount(DomainEntity, {
      where: {
        parent_id: domain_id,
      },
      take: n,
      skip: n * (page - 1),
    });
    return {
      domains,
      total,
      n,
    };
  },

  async get_domains(page: number, n = 20) {
    const [domains, total] = await manager.findAndCount(DomainEntity, {
      where: {
        parent_id: '',
      },
      take: n,
      skip: n * (page - 1),
    });
    return {
      domains,
      total,
      n,
    };
  },

  async get_proposals(domain_id: DomainID, page: number, n = 20) {
    const [pairs, total] = await manager.findAndCount(DomainProposalPair, {
      where: {
        domain_id,
      },
      order: {
        proposal_status: 'DESC',
        computed_n_participant: 'DESC',
      },
      take: n,
      skip: n * (page - 1),
    });
    return {
      proposals: pairs,
      total,
      n,
    };
  },
});

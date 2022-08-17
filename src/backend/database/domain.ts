import { IDBDomain, Domain, DomainID, ProposalID } from '../types';
import { IDatabase, ProposalStatus } from '../../shared/types';
import DomainEntity from './entity/domain';
import DomainProposalPair from './entity/domain-proposal-pair';
import { Not } from 'typeorm';

export default class APIDomain implements IDBDomain {
  db: IDatabase;
  constructor(db: IDatabase) {
    this.db = db;
  }

  public async rename_domain(domain_id: DomainID, name: string) {
    await this.db.connection.manager.update(
      DomainEntity,
      { id: domain_id },
      { name },
    );
  }

  /**
   * domain_id 合并到 target_domain_id
   */
  public async merge_domain(target_domain_id: DomainID, domain_id: DomainID) {
    // TODO
  }

  public async has_domain(domain_id: DomainID) {
    return !!(await this.db.connection.manager.count(DomainEntity, {
      id: domain_id,
    }));
  }

  public async proposal_is_in_domain(
    proposal_id: ProposalID,
    domain_id: DomainID,
  ) {
    return !!await this.db.connection.manager.count(DomainProposalPair, {
      domain_id,
      proposal_id,
    });
  }

  public async get_domain_top(domain_id: DomainID) {
    const pair = await this.db.connection.manager.findOne(DomainProposalPair, {
      where: {
        domain_id,
        proposal_status: Not(ProposalStatus.done),
      },
      order: {
        computed_n_participant: 'DESC',
      }
    });
    return pair ? pair.proposal_id : undefined;
  }

  public async add_domain(domain_id: DomainID, domain: Domain, parent_id: DomainID = '') {
    await this.db.connection.manager.insert(DomainEntity, {
      id: domain_id,
      name: domain.name,
      parent_id,
    });
  }

  public async activate_proposals() {
    const domains = await this.db.connection.manager.find(DomainEntity);
    for (const domain of domains) {
      const top = await this.get_domain_top(domain.id);
      if (top) {
        const status = await this.db.proposal.get_proposal_status(top);
        if (status === ProposalStatus.inactivated) {
          await this.db.proposal.activate(top);
        }
      }
    }
  }

  public async get_domain(domain_id: DomainID) {
    return await this.db.connection.manager.findOne(DomainEntity, domain_id);
  }
  
  public async get_sub_domains(domain_id: string, page: number, n = 20) {
    const [domains, total] = await this.db.connection.manager.findAndCount(DomainEntity, {
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
  }

  public async get_domains(page: number, n = 20) {
    const [domains, total] = await this.db.connection.manager.findAndCount(DomainEntity, {
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
  }

  public async get_proposals(domain_id: DomainID, page: number, n = 20) {
    const [pairs, total] = await this.db.connection.manager.findAndCount(DomainProposalPair, {
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
  }
}

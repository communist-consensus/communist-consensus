import { Domain, DomainID, ProposalID } from '../types';
import { ProposalStatus } from '../../../shared/types';
import DomainEntity from './entity/domain';
import DomainProposalPair from './entity/domain-proposal-pair';
import { EntityManager, Not } from 'typeorm';

export async function rename_domain(
  manager: EntityManager,
  domain_id: DomainID,
  name: string,
) {
  await manager.update(DomainEntity, { uuid: domain_id }, { name });
}

/**
 * domain_id 合并到 target_domain_id
 */
export async function merge_domain(
  manager: EntityManager,
  target_domain_id: DomainID,
  domain_id: DomainID,
) {
  // TODO
}

export async function has_domain(manager: EntityManager, domain_id: DomainID) {
  return !!(await manager.count(DomainEntity, {
    where: {
      uuid: domain_id,
    },
  }));
}

export async function proposal_is_in_domain(
  manager: EntityManager,
  proposal_uuid: ProposalID,
  domain_uuid: DomainID,
) {
  return !!(await manager.count(DomainProposalPair, {
    where: {
      domain_uuid,
      proposal_uuid,
    },
  }));
}

export async function get_domain_top(manager: EntityManager, domain_uuid: DomainID) {
  const pair = await manager.findOne(DomainProposalPair, {
    where: {
      domain_uuid,
      proposal_status: Not(ProposalStatus.done),
    },
    order: {
      computed_n_participant: 'DESC',
    },
  });
  return pair ? pair.proposal_uuid : undefined;
}

export async function add_domain(
  manager,
  domain_id: DomainID,
  domain: Domain,
  parent_uuid: DomainID = '',
) {
  await manager.insert(DomainEntity, {
    uuid: domain_id,
    name: domain.name,
    parent_uuid,
  });
}

export async function activate_proposals(manager: EntityManager) {
  const domains = await manager.find(DomainEntity);
  // TODO
  for (const domain of domains) {
    const top = await this.get_domain_top(domain.uuid);
    if (top) {
      const status = await this.db.proposal.get_proposal_status(top);
      if (status === ProposalStatus.inactivated) {
        await this.db.proposal.activate(top);
      }
    }
  }
}

export async function get_domain(manager, domain_id: DomainID) {
  return await manager.findOne(DomainEntity, {
    where: {
      uuid: domain_id,
    },
  });
}

export async function get_sub_domains(
  manager: EntityManager,
  domain_uuid: string,
  page: number,
  n = 20,
) {
  const [domains, total] = await manager.findAndCount(DomainEntity, {
    where: {
      parent_uuid: domain_uuid,
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

export async function get_domains(manager: EntityManager, page: number, n = 20) {
  const [domains, total] = await manager.findAndCount(DomainEntity, {
    where: {
      parent_uuid: '',
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

export async function get_proposals(
  manager: EntityManager,
  domain_uuid: DomainID,
  page: number,
  n = 20,
) {
  const [pairs, total] = await manager.findAndCount(DomainProposalPair, {
    where: {
      domain_uuid,
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

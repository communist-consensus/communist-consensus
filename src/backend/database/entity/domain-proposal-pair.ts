import { Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { ProposalStatus, IPFSAddress, DBDomainProposalPair } from '../../../shared/types';
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
export default class DomainProposalPair implements DBDomainProposalPair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: ID_LENGTH })
  domain_id: string;

  @Column('varchar', { length: ID_LENGTH })
  proposal_id: string;

  @Column({
    type: 'int',
    default: ProposalStatus.inactivated,
  })
  proposal_status: ProposalStatus;

  @Column('bigint', { transformer: [bigint] })
  computed_n_participant: number;
}
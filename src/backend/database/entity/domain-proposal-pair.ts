import {
  Entity,
  PrimaryColumn,
  OneToMany,
  Column,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ID_LENGTH } from '../../../../shared/constant';
import {
  ProposalStatus,
  IPFSAddress,
  DBDomainProposalPair,
} from '../../../../shared/types';
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
export default class DomainProposalPair implements DBDomainProposalPair {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  domain_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  proposal_uuid: string;

  @Column({
    type: 'int',
    default: ProposalStatus.inactivated,
  })
  proposal_status: ProposalStatus;

  @Column('bigint', { transformer: [bigint] })
  computed_n_participant: number;
}

import {
  Index,
  Entity,
  PrimaryColumn,
  OneToMany,
  Column,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ID_LENGTH } from '../../../../shared/constant';
import { ProposalStatus, IPFSAddress, DBDomain } from '../../../../shared/types';
import Proposal from './proposal';

@Entity()
@Index(['uuid', 'parent_uuid'], { unique: true })
export default class Domain implements DBDomain {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  name: string;

  @Column('varchar', { length: ID_LENGTH })
  parent_uuid: string;
}

import { Index, Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { ProposalStatus, IPFSAddress } from '../../../shared/types';
import Proposal from './proposal';

@Entity()
@Index(['id', 'parent_id'], { unique: true })
export default class Domain {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  id: string;

  @Column('varchar', { length: ID_LENGTH })
  name: string;

  @Column('varchar', { length: ID_LENGTH })
  parent_id: string;
}
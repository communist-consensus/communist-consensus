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
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ID_LENGTH } from '../../../../shared/constant';
import { ProposalStatus, IPFSAddress } from '../../../../shared/types';
import Proposal from './proposal';

@Entity()
@Index(['solution_uuid', 'task_uuid'], { unique: true })
export default class SolutionTaskPair {
  @PrimaryGeneratedColumn('uuid')
  uuid: number;

  @Column('varchar', { length: ID_LENGTH })
  solution_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  task_uuid: string;
}

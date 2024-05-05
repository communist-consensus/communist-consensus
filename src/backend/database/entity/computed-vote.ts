import {
  Index,
  ManyToOne,
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ID_LENGTH } from '../../../../shared/constant';
import { bigint } from '../transformer';
import Conference from './conference';
import Peer from './peer';
import Solution from './solution';

@Entity()
@Index(['solution_uuid', 'conference_id'], { unique: true })
export default class ComputedVote {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  solution_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  conference_id: string;

  @Column('bigint', { transformer: [bigint] })
  n_vote: number;
}

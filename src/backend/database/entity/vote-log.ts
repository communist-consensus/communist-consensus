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
import Conference from './conference';
import Peer from './peer';
import Solution from './solution';

@Entity()
@Index(['conference_uuid', 'solution_uuid', 'peer_uuid'], { unique: true })
export default class VoteLog {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  solution_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  conference_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  peer_uuid: string;
}

import { Index, ManyToOne, Entity, PrimaryColumn, Column, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import Conference from './conference';
import Peer from './peer';
import Solution from './solution';

@Entity()
@Index(['conference_id', 'solution_id', 'peer_id'], { unique: true })
export default class VoteLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: ID_LENGTH })
  solution_id: string;

  @Column('varchar', { length: ID_LENGTH })
  conference_id: string;

  @Column('varchar', { length: ID_LENGTH })
  peer_id: string;

}
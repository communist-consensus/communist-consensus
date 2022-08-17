import { Index, Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { ProposalStatus, IPFSAddress, DBConferenceSolutionPair } from '../../../shared/types';
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
@Index(['solution_id', 'round_id'], { unique: true })
@Index(['solution_id', 'conference_id'], { unique: true })
export default class ConferenceSolutionPair
  implements DBConferenceSolutionPair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: ID_LENGTH })
  solution_id: string;

  @Column('varchar', { length: ID_LENGTH })
  conference_id: string;

  @Column('bigint', { transformer: [bigint] })
  round_id: number;
}
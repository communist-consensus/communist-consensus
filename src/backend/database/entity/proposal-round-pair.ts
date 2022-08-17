import { Index, Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { ProposalStatus, IPFSAddress } from '../../../shared/types';
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
@Index(['proposal_id', 'round_id'], { unique: true })
export default class ProposalRoundPair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: ID_LENGTH })
  proposal_id: string;

  @Column('bigint')
  round_id: number;

  @Column({ type: 'bigint', default: 0, transformer: [bigint] })
  start_timestamp: number;

  @Column({ type: 'bigint', default: 0, transformer: [bigint] })
  end_timestamp: number;
}
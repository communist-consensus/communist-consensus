import { Index, Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { ProposalStatus, IPFSAddress } from '../../../shared/types';
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
@Index(['peer_id', 'conference_id', 'proposal_id', 'round_id'], { unique: true })
@Index(['peer_id', 'proposal_id', 'round_id'], { unique: true })
export default class ConferencePeerPair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: ID_LENGTH })
  peer_id: string;

  @Column('varchar', { length: ID_LENGTH })
  conference_id: string;

  @Column('varchar', { length: ID_LENGTH })
  proposal_id: string;

  @Column('bigint', { transformer: [bigint] })
  round_id: number;
}
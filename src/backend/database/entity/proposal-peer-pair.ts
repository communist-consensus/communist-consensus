import { Index, Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { ProposalStatus, IPFSAddress } from '../../../shared/types';
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
@Index(['peer_id', 'proposal_id'], { unique: true })
export default class ProposalPeerPair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: ID_LENGTH })
  proposal_id: string;

  @Column('varchar', { length: ID_LENGTH })
  peer_id: string;

  @Column('bigint', { transformer: [bigint] })
  discussion_voting_duration: number;
  @Column('bigint', { transformer: [bigint] })
  max_n_proposer: number;
}
import { OneToMany, Entity, PrimaryColumn, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { ProposalStatus, IPFSAddress, DBProposal } from '../../../shared/types';
import Solution from './solution';
import Domain from './domain';
import Peer from './peer';
import Conference from './conference';
import { ID_LENGTH, TITLE_LENGTH } from '../../../shared/constant';
import { bigint } from '../transformer';

@Entity()
export default class Proposal implements DBProposal {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  id: string;

  @Column('varchar', { length: ID_LENGTH })
  prev_block_hash: IPFSAddress;

  @Column('varchar', { length: ID_LENGTH })
  computed_latest_conference_id: string;

  @Column('varchar', { length: ID_LENGTH })
  content_cid: IPFSAddress;

  @Column('varchar', { length: TITLE_LENGTH })
  title: string;

  @Column('varchar', { length: ID_LENGTH })
  originator_id: string;

  @Column({
    type: 'int',
    default: ProposalStatus.inactivated,
  })
  status: ProposalStatus;

  @Column('bigint', { transformer: [bigint] })
  computed_n_round: number;

  @Column('bigint', { transformer: [bigint] })
  computed_n_participant: number;

  @Column('bigint', { transformer: [bigint] })
  computed_discussion_voting_duration: number;
  @Column('bigint', { transformer: [bigint] })
  computed_max_n_proposer: number;

  @Column('bigint', { transformer: [bigint] })
  accumulated_discussion_voting_duration: number;
  @Column('bigint', { transformer: [bigint] })
  accumulated_max_n_proposer: number;

  @Column('bigint', { transformer: [bigint] })
  make_proposal_timestamp: number;
  @Column('bigint', { transformer: [bigint] })
  computed_discussion_voting_end: number;
  @Column('bigint', { transformer: [bigint] })
  computed_publicity_end: number;

  @Column('varchar', { length: ID_LENGTH, default: '' })
  computed_final_solution_id: string;
  @Column('varchar', { length: ID_LENGTH, default: '' })
  computed_final_conference_id: string;
}
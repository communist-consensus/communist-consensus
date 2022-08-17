import { Index, Entity, PrimaryColumn, OneToMany, Column, JoinTable, ManyToMany, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { ProposalStatus, IPFSAddress, ConferenceStatus, DBConference } from '../../../shared/types';
import Proposal from './proposal';
import Solution from './solution';
import VoteLog from './vote-log';
import ComputedVote from './computed-vote';
import { ID_LENGTH } from '../../../shared/constant';
import { bigint } from '../transformer';

@Entity()
@Index(['round_id', 'proposal_id'], { unique: true })
export default class Conference implements DBConference {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  id: string;

  @Column({
    type: 'int',
    default: ConferenceStatus.ready,
  })
  status: ConferenceStatus;

  @Column('bigint', { transformer: [bigint] })
  round_id: number;

  @Column('varchar', { length: ID_LENGTH })
  proposal_id: string;

  @Column('bigint', { transformer: [bigint] })
  computed_n_proposer: number;

  @Column('bigint', { transformer: [bigint] })
  computed_max_n_vote: number;
}
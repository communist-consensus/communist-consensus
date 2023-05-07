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
import { bigint } from '../transformer';
import Proposal from './proposal';

@Entity()
@Index(['peer_uuid', 'conference_uuid', 'proposal_uuid', 'round_id'], {
  unique: true,
})
@Index(['peer_uuid', 'proposal_uuid', 'round_id'], { unique: true })
export default class ConferencePeerPair {
  @PrimaryGeneratedColumn('uuid')
  uuid: number;

  @Column('varchar', { length: ID_LENGTH })
  peer_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  conference_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  proposal_uuid: string;

  @Column('bigint', { transformer: [bigint] })
  round_id: number;
}

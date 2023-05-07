import {
  ManyToOne,
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IPFSAddress } from '../../../../shared/types';
import Peer from './peer';
import Solution from './solution';
import Proposal from './proposal';
import { ID_LENGTH } from '../../../../shared/constant';

@Entity()
export default class ProposalComment {
  @PrimaryGeneratedColumn('uuid')
  uuid: number;

  @Column('varchar', { length: ID_LENGTH })
  content_cid: IPFSAddress<string>;

  @Column('varchar', { length: ID_LENGTH })
  proposal_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  peer_uuid: string;
}

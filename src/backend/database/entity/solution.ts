import {
  Index,
  ManyToOne,
  OneToMany,
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { DBSolution, IPFSAddress } from '../../../shared/types';
import Conference from './conference';
import Proposal from './proposal';
import Task from './task';
import Peer from './peer';
import { ID_LENGTH } from '../../../shared/constant';

@Entity()
export default class Solution implements DBSolution {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  id: string;

  @Column('varchar', { length: ID_LENGTH })
  peer_id: string;

  @Column('varchar', { length: ID_LENGTH })
  content_cid: IPFSAddress;
}

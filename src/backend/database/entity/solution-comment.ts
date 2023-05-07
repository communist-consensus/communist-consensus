import {
  ManyToOne,
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DBSolutionComment, IPFSAddress, SolutionContent } from '../../../../shared/types';
import Peer from './peer';
import Solution from './solution';
import Proposal from './proposal';
import { ID_LENGTH } from '../../../../shared/constant';

@Entity()
export default class SolutionComment implements DBSolutionComment {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  content_cid: IPFSAddress<SolutionContent>;

  @Column('varchar', { length: ID_LENGTH })
  solution_uuid: string;

  @Column('varchar', { length: ID_LENGTH })
  peer_uuid: string;
}

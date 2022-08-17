import { OneToMany, Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { DBTask, IPFSAddress, VITaskType } from '../../../shared/types';
import Proposal from './proposal';
import Solution from './solution';

@Entity()
export default class Task implements DBTask {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  id: string;

  @Column({
    type: 'int',
  })
  type: VITaskType;

  @Column('blob')
  args: Uint8Array;
}
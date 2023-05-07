import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABALog, DBRBCReady, IPFSAddress, NodeID, Actions  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Index(['cid', 'epoch', 'provider'])
@Unique(['epoch', 'sender', 'provider'])
export default class RBCReady implements DBRBCReady {
  @PrimaryGeneratedColumn(
    'uuid',
  )
  uuid: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  root_block_cid: IPFSAddress<DBBlock>;

  @Column('varchar', { length: ID_LENGTH, comment: 'Who sends rbc ready msg' })
  sender: NodeID;

  @Column('varchar', { length: ID_LENGTH, comment: 'Who provides actions' })
  provider: NodeID;

  @Column('varchar', { length: ID_LENGTH })
  cid: IPFSAddress<Actions>;

  @Column('blob')
  signature: Buffer;
}

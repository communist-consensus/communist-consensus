import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABALog, NodeID, IPFSAddress, RBCStage, DBRBCResolved, Actions } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Unique(['root_block_cid', 'epoch', 'provider'])
export default class RBCResolved implements DBRBCResolved {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: URL_MAX_LENGTH })
  root_block_cid: IPFSAddress<DBBlock>;

  @Column('varchar', { length: ID_LENGTH })
  provider: NodeID;

  @Column('varchar', { length: ID_LENGTH, nullable: true })
  cid: IPFSAddress<Actions>;
}

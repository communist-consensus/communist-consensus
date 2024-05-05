import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABALog, DBRBCReady, DBRBCEcho, IPFSAddress, NodeID  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Unique(['root_block_cid', 'epoch', 'piece_receiver', 'piece_provider', 'sender'])
export default class RBCEcho implements DBRBCEcho {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  sender: NodeID;

  @Column('varchar', { length: ID_LENGTH })
  piece_receiver: NodeID;

  @Column('varchar', { length: URL_MAX_LENGTH })
  root_block_cid: IPFSAddress<DBBlock>;

  @Column('varchar', { length: ID_LENGTH })
  piece_provider: NodeID;

  @Column('varchar', { length: ID_LENGTH, default: '' })
  roothash: string;

  @Column('blob')
  branch: Buffer;

  @Column('blob')
  piece: Buffer;

  @Column('blob')
  signature: Buffer;
}

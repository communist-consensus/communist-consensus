import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABALog, DBRBCVal, IPFSAddress, NodeID, Signature  } from '../../../../shared/types';
import { bigint } from '../transformer';
import { RBCValMessage } from '../../types';

@Entity()
@Unique(['root_block_cid', 'epoch', 'piece_provider'])
export default class RBCVal implements DBRBCVal {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: URL_MAX_LENGTH })
  root_block_cid: IPFSAddress<DBBlock>;

  @Column('varchar', { length: ID_LENGTH })
  piece_provider: NodeID;

  @Column('varchar', { length: ID_LENGTH })
  piece_receiver: NodeID;

  @Column('varchar', { length: ID_LENGTH })
  root_hash: string;

  @Column('varchar', { length: ID_LENGTH })
  roothash: string;

  @Column('blob')
  piece: Buffer;

  @Column('blob')
  branch: Buffer;

  @Column('blob')
  signature: Signature<RBCValMessage>;
}

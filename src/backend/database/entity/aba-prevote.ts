import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABALog, DBABAPrevote, IPFSAddress  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Unique(['root_block_cid', 'epoch', 'session_id', 'round', 'sender', 'val'])
export default class ABAPrevote implements DBABAPrevote {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  session_id: string;

  @Column('varchar', { length: ID_LENGTH })
  root_block_cid: IPFSAddress<DBBlock>;

  @Column('int')
  round: number;

  @Column('varchar', { length: ID_LENGTH })
  sender: string;

  @Column('int')
  val: number;

  @Column('blob')
  signature: Buffer;
}

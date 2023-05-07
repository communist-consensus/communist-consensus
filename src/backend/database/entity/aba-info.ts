import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABAInfo, ABAProtocolStage, ABAValue, IPFSAddress } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Index(['stage'])
@Unique(['root_block_cid', 'epoch', 'session_id'])
export default class ABAInfo implements DBABAInfo {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  root_block_cid: IPFSAddress<DBBlock>;

  @Column('varchar', { length: ID_LENGTH })
  session_id: string;

  @Column('int')
  round: number;

  @Column({
    type: 'varchar', length: 40,
  })
  stage: ABAProtocolStage;

  @Column('int')
  val: ABAValue;
}

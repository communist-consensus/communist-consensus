import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABA  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Index(['cid', 'epoch', 'source_provider'])
@Unique(['epoch', 'sender', 'source_provider'])
export default class RBCREADY {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  sender: string;

  @Column('varchar', { length: ID_LENGTH })
  source_provider: string;

  @Column('varchar', { length: ID_LENGTH })
  cid: string;

  @Column('blob')
  signature: Buffer;
}

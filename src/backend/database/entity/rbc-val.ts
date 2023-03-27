import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABA  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Unique(['epoch', 'sender'])
export default class RBCVAL {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  sender: string;

  @Column('blob')
  val: Buffer;
}

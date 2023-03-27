import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABA  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Index(['epoch', 'session_id', 'round', 'stage'])
@Unique(['epoch', 'session_id', 'round', 'stage', 'sender'])
export default class ABA implements DBABA {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  session_id: string;

  @Column('int')
  round: number;

  @Column('int')
  stage: number;

  @Column('varchar', { length: ID_LENGTH })
  sender: string;

  @Column('int')
  val: number;
}

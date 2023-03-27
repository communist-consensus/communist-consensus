import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABA, DBABAPrevote  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Unique(['epoch', 'session_id', 'round', 'sender', 'val'])
export default class ABAPrevote implements DBABAPrevote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  session_id: string;

  @Column('int')
  round: number;

  @Column('varchar', { length: ID_LENGTH })
  sender: string;

  @Column('int')
  val: number;
}

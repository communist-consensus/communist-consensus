import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock, DBABA  } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
@Index(['roothash', 'epoch', 'source_provider'])
@Unique(['epoch', 'piece_owner', 'source_provider'])
export default class RBCECHO {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  piece_owner: string;

  @Column('varchar', { length: ID_LENGTH })
  source_provider: string;

  @Column('varchar', { length: ID_LENGTH, default: '' })
  roothash: string;

  @Column('blob')
  val: Buffer;
}

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ID_LENGTH, KV_LENGTH } from '../../../../shared/constant';

@Entity()
export default class KV {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  key: string;

  @Column('varchar', { length: KV_LENGTH })
  value: string;

  @Column('varchar', { length: ID_LENGTH })
  prefix: string;

  @Column('varchar', { length: ID_LENGTH })
  name: string;
}

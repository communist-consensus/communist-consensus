import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';

@Entity()
export default class KV {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  key: string;

  @Column('tinyblob')
  value: Uint8Array;

  @Column('varchar', { length: ID_LENGTH })
  prefix: string;

  @Column('varchar', { length: ID_LENGTH })
  name: string;
}

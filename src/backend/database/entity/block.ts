import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { DBBlock } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
export default class Block implements DBBlock {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  block_hash: string;

  @Column('int')
  epoch: number;

  @Column('varchar', { length: ID_LENGTH })
  prev_block_hash: string;

  @Column('varchar', { length: URL_MAX_LENGTH })
  ecrbc_proofs: string;

  @Column('varchar', { length: URL_MAX_LENGTH })
  aba_proofs: string;
}

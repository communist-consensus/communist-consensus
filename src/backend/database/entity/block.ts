import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ID_LENGTH, URL_MAX_LENGTH } from '../../../../shared/constant';
import { ABAProof, DBBlock, IPFSAddress, MassActions, RBCProof } from '../../../../shared/types';
import { bigint } from '../transformer';

@Entity()
export default class Block implements DBBlock {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  block_cid: IPFSAddress<DBBlock>;

  @Column('int')
  epoch: number;

  @Column('bigint', { transformer: bigint })
  start_timestamp: number;

  @Column('varchar', { length: ID_LENGTH })
  prev_block_cid: IPFSAddress<DBBlock>;

  @Column('varchar', { length: URL_MAX_LENGTH })
  mass_actions: IPFSAddress<MassActions>;

  @Column('varchar', { length: URL_MAX_LENGTH })
  rbc_proofs: IPFSAddress<RBCProof[]>;

  @Column('varchar', { length: URL_MAX_LENGTH })
  aba_proofs: IPFSAddress<ABAProof[]>;
}

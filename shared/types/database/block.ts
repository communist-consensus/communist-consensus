import { BlockContext } from '../consensus';
import { IPFSAddress } from '../common';

export interface IDBBlock {
  get_block: (block_hash: IPFSAddress) => Promise<DBBlock>;
  get_blocks: () => Promise<DBBlock[]>;
  get_n_block: () => Promise<number>;
  get_root_block: () => Promise<DBBlock>;
  get_next_block: (block_hash: IPFSAddress) => Promise<DBBlock>;
  get_latest_block: () => Promise<DBBlock>;

  add_block: (block_ctx: BlockContext) => Promise<void>;
}
export type DBBlock = {
  block_hash: string;
  prev_block_hash: IPFSAddress;
  ecrbc_proofs: IPFSAddress;
  aba_proofs: IPFSAddress;
  epoch: number;
};

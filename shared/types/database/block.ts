import { EntityManager } from 'typeorm';
import { IPFSAddress, NodeID } from '../common';
import { ABAProof } from './aba';
import { MassActions } from '../consensus';
import { RBCProof } from './rbc';

export type DBBlock = {
  /**
   * block_cid computed by hash(actions)
   */
  block_cid: IPFSAddress<DBBlock>;
  prev_block_cid: IPFSAddress<DBBlock>;
  epoch: number;

  start_timestamp: number;

  /**
   * only whose aba proof output 1 will be involved
   */
  mass_actions: IPFSAddress<MassActions>;

  /**
   * warning: signatories of proofs may vary, so its IPFSAddress may vary
   * 
   * proofs order by node id (asc)
   */
  rbc_proofs: IPFSAddress<RBCProof[]>;
  aba_proofs: IPFSAddress<ABAProof[]>;
};

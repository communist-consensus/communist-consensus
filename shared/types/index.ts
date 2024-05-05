import type { Libp2p } from 'libp2p';
export * from './database';
export * from './consensus';
export * from './dht-helper';
export * from './common';

import { ABAProtocols, Profile, RBCProtocols } from './consensus';
import { IDHTHelper } from './dht-helper';
import { EventEmitter } from 'tsee';
import { IPFSAddress, NodeID } from './common';
import { DBBlock, SubProtocols } from '../../src/backend/types';
import { DataSource } from 'typeorm';
import { DualKadDHT, KadDHT } from '@libp2p/kad-dht';

export type ConsensusConfig = Profile & {
  private_key: string; // base64pad, rsa2048
};

export type InitialParams = {
  config: ConsensusConfig;
  initial_timestamp: number;
};

export type Context = {
  root_block_cid: IPFSAddress<DBBlock>;
  prev_block_cid: IPFSAddress<DBBlock>;
  epoch: number;
  N: number; // Number of nodes in the network.
  f: number; // Number of faulty nodes that can be tolerated.
  start_timestamp: number;
  interval: number;

  node_id: NodeID; // Node id.
  datasource: DataSource;
  sk: Uint8Array;
  pk: Uint8Array;
  libp2p_node?: Libp2p<{dht: DualKadDHT}>;
  log?: (...args: any[]) => void;
  dht_helper?: IDHTHelper<SubProtocols>;
  ee: EventEmitter<BFTEvents>;
};

export type BFTEvents = {
  new_block: (block_cid: IPFSAddress<DBBlock>) => void;
};

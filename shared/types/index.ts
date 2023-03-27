import type { Libp2p } from 'libp2p';
import { PeerId } from '@libp2p/interface-peer-id';
export * from './database';
export * from './consensus';
export * from './p2p';
export * from './common';

import { IDatabase, IDatabaseManager } from './database';
import {
  ActionBundle,
  Actions,
  ActionSubjects,
  BlockContext,
  Profile,
} from './consensus';
import { IP2PBroadcastProtocol, RILibp2p } from './p2p';
import EventEmitter from 'events';
import { NodeID } from './common';

export type ConsensusConfig = {
  public_key: string; // base64pad, rsa2048
  private_key: string; // base64pad, rsa2048
};

export type InitialParams = {
  config: ConsensusConfig;
  initial_timestamp: number;
};

export type Signature = Uint8Array;

export type CID = string;

export interface IContentDeliverer {
  provide: (x: any) => Promise<CID>;
  get: <T>(cid: CID) => Promise<T>;
}

export type Context = {
  epoch: number;
  node_id: NodeID; // Node id.
  db: IDatabase;
  N: number; // Number of nodes in the network.
  f: number; // Number of faulty nodes that can be tolerated.
  sk: Uint8Array;
  pk: Uint8Array;
  PKs: { [node_id: string]: Uint8Array }; // list PK2s: an array of ``coincurve.PublicKey'', i.e., N public keys of ECDSA for all parties
  peer_ids: { [node_id: string]: PeerId };
  node_id_to_index: { [node_id: string]: number };
  libp2p_node?: Libp2p;
  content_deliverer: IContentDeliverer;
  log?: (...args: any[]) => void;
  p2pbroadcast_protocol?: IP2PBroadcastProtocol;
};

import type { Libp2p } from 'libp2p';
import { EventEmitter } from 'events';
import { Multiaddr } from 'multiaddr';
import { PeerId } from '@libp2p/interface-peer-id';

import { Connection, Stream } from '@libp2p/interface-connection';
import { Encoded, IPFSAddress, NodeID } from '../common';
import { EntityManager } from 'typeorm';
import { SubProtocols } from '../consensus';
export interface INetworkDetect extends EventEmitter {
  address: string;
}

export interface IDynamicRelay {
  mount: () => void;
  update: () => Promise<void>;
  start_timer: () => void;
  reset_idle_timer: () => void;
}

export type KBucketContact = {
  id: Uint8Array;
  [key: string]: any;
};

export type KBucketNode = {
  contacts: KBucketContact[] | null;
  left?: KBucketNode;
  right?: KBucketNode;
};

export interface IKBucket extends EventEmitter {
  root: KBucketNode;
  localNodeId: Uint8Array;
  numberOfNodesPerKBucket: number;
  numberOfNodesToPing: number;
  distance: (id_a: Uint8Array, id_b: Uint8Array) => number;
  arbiter: (
    incumbent: KBucketContact,
    candidate: KBucketContact,
  ) => KBucketContact;
  add: (contact: KBucketContact) => IKBucket;
  closest: (
    id: Uint8Array,
    max_number_of_returning_contacts?: number,
  ) => KBucketContact[];
  count: () => number;
  _determineNode: (
    node: KBucketNode,
    id: Uint8Array,
    bit_idx: number,
  ) => KBucketNode;
  get: (id: Uint8Array) => KBucketContact;
  remove: (id: Uint8Array) => IKBucket;
  _indexOf: (node: KBucketNode, id: Uint8Array) => number;
  _split: (node: KBucketNode, bit_idx: number) => void;
  toArray: () => KBucketContact[];
  toIterable: () => Iterable<KBucketContact[]>;
  _update: (node: KBucketNode, index: number, contact: KBucketContact) => void;
}

export type Input = Uint8Array;

export type IDHTBroadcastHandler<T> = (
  node_id: NodeID,
  msg: IDHTHelperCommonMessage<T>,
  connection: Connection,
  stream: Stream,
) => void;
export type IDHTBroadcastHandlerMap<T> = Map<T, IDHTBroadcastHandler<T>[]>;
export interface IDHTHelperCommonMessage<T> {
  subProtocol: T;
  msg: Uint8Array;
  signature: Uint8Array;
}

export interface IDHTHelper<T> {
  addListener: (subProtocol: T, handler: IDHTBroadcastHandler<T>) => void;
  removeListener: (subProtocol: T, handler: IDHTBroadcastHandler<T>) => void;

  broadcast: (
    common_msg: IDHTHelperCommonMessage<T>,
  ) => Promise<void>;
  // kb_broadcast: <T>(msg: <T>) => Promise<void>;
  send: <T>(
    target: NodeID,
    common_msg: IDHTHelperCommonMessage<T>,
  ) => Promise<void>;

  provide?: <T>(x: Encoded<T>) => Promise<IPFSAddress<T>>;
  get: <T>(cid: IPFSAddress<T>) => Promise<T>;
}

export type DHTBroadcastProtocolOptions = {
  success_rate: number; // （预计）单次传播的成功率
  up_rate: number; // （预计）在线率
  expected_success_rate: number;
};
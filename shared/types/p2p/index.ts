import type { Libp2p } from 'libp2p';
import { EventEmitter } from 'events';
import { Multiaddr } from 'multiaddr';
import { PeerId } from '@libp2p/interface-peer-id';

import { Connection, Stream } from '@libp2p/interface-connection';
import { NodeID } from '../common';
export interface IAddressChecker {
  mount: () => void;
  check: (peer_or_connection: {
    peer?: PeerId;
    connection?: Connection;
  }) => Promise<Multiaddr>;
}

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

export type RBCOutputs = Map<NodeID, Uint8Array>;

export type IP2PBroadcastHandler<T> = (
  peer: PeerId,
  msg: T,
  connection: Connection,
  stream: Stream,
) => void;
export type IP2PBroadcastHandlerMap<T> = Map<string, IP2PBroadcastHandler<IP2PBroadcastSubProtocolMessageWrapper<T>>[]>;
export interface IP2PBroadcastProtocol {
  addListener: <T>(
    subProtocol: string,
    handler: IP2PBroadcastHandler<IP2PBroadcastSubProtocolMessageWrapper<T>>,
  ) => void;
  removeListener: <T>(
    subProtocol: string,
    handler: IP2PBroadcastHandler<IP2PBroadcastSubProtocolMessageWrapper<T>>,
  ) => void;

  broadcast: <T>(msg: IP2PBroadcastSubProtocolMessageWrapper<T>) => Promise<void>;
  // kb_broadcast: <T>(msg: IP2PBroadcastProtocolDecodedMessage<T>) => Promise<void>;
  send: <T>(
    target: NodeID,
    msg: IP2PBroadcastSubProtocolMessageWrapper<T>,
  ) => Promise<void>;
}

export type RILibp2p = Libp2p & {
  address_checker: IAddressChecker;
  network_detect: INetworkDetect;
  dynamic_relay: IDynamicRelay;
  p2pbroadcast_protocol: IP2PBroadcastProtocol;
};

export type P2PBroadcastProtocolOptions = {
  success_rate: number; // （预计）单次传播的成功率
  up_rate: number; // （预计）在线率
  expected_success_rate: number;
};

export type IP2PBroadcastSubProtocolMessageWrapper<T> = {
  subProtocol: string;
} & T;

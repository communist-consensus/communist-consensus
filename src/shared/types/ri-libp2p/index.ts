import Libp2p from 'libp2p';
import { EventEmitter } from 'events';
import { Multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import { IPFSAddress } from '../common';
import { ActionsTestimony, BlockContext, WitnessTestimony } from '../r-internationale';
import { DBBlock, PendingBlock } from '../database';

export interface IAddressChecker {
  mount: () => void;
  check: (peer_or_connection: {
    peer?: PeerId,
    connection?: Libp2p.Connection,
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
  arbiter: (incumbent: KBucketContact, candidate: KBucketContact) => KBucketContact;
  add: (contact: KBucketContact) => IKBucket;
  closest: (id: Uint8Array, max_number_of_returning_contacts?: number) => KBucketContact[];
  count: () => number;
  _determineNode: (node: KBucketNode, id: Uint8Array, bit_idx: number) => KBucketNode;
  get: (id: Uint8Array) => KBucketContact;
  remove: (id: Uint8Array) => IKBucket;
  _indexOf: (node: KBucketNode, id: Uint8Array) => number;
  _split: (node: KBucketNode, bit_idx: number) => void;
  toArray: () => KBucketContact[];
  toIterable: () => Iterable<KBucketContact[]>;
  _update: (node: KBucketNode, index: number, contact: KBucketContact) => void;
}

export type ResRequestNextBlock = {
  code: NextBlockhashResCode;
  next?: DBBlock;
  pending_block?: PendingBlock;
};

export enum NextBlockhashResCode {
  ok = 1,
  notReady,
  reqBlockNotExists,
  nextBlockNotExists,
  rootBlockNotExists,
}

export interface IConsensusProtocol {
  options: ConsensusProtocolOptions;
  request_next_block: (peer_or_connection_or_maddr: {
    peer?: PeerId;
    connection?: Libp2p.Connection;
    maddr?: string;
    random_addr?: boolean;
    block_hash?: IPFSAddress;
  }) => Promise<ResRequestNextBlock>;
  broadcast_actions_testimony: (
    actions_testimony: ActionsTestimony,
    signature: Uint8Array,
  ) => Promise<void>;
  broadcast_witness_testimony: (
    witness_testimony_cid: IPFSAddress,
    signature: Uint8Array,
  ) => Promise<void>;

  broadcast_one: {
    [key: string]: (
      target_contact: KBucketContact,
      src: Uint8Array,
      msg: any,
    ) => Promise<void>;
  };
  handlers: {
    next_block: (options: {
      connection: Libp2p.Connection;
      stream: Libp2p.MuxedStream;
      args: Uint8Array;
    }) => Promise<void>;
    [BroadcastType.broadcast_actions_testimony]: (options: {
      connection: Libp2p.Connection;
      stream: Libp2p.MuxedStream;
      args: Uint8Array;
    }) => Promise<void>;
    [BroadcastType.broadcast_witness_testimony]: (options: {
      connection: Libp2p.Connection;
      stream: Libp2p.MuxedStream;
      args: Uint8Array;
    }) => Promise<void>;
  };
  do_forward_witness_testimony: (args: any, src: Uint8Array, n_peer: number) => Promise<void>;
}

export type RILibp2p = Libp2p & {
  address_checker: IAddressChecker;
  network_detect: INetworkDetect;
  dynamic_relay: IDynamicRelay;
  consensus_protocol: IConsensusProtocol;
};

export enum BroadcastType {
  broadcast_actions_testimony = 'broadcast_actions_testimony',
  broadcast_witness_testimony = 'broadcast_witness_testimony',
}

export type ConsensusProtocolOptions = {
  success_rate: number; // （预计）单次传播的成功率
  up_rate: number; // （预计）在线率
  expected_success_rate: number;
};
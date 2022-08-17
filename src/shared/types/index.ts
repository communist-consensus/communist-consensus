export * from './ipfs';
export * from './database';
export * from './r-internationale';
export * from './ri-libp2p';
export * from './common';

import { IIPFS } from './ipfs';
import { IDatabase } from './database';
import { ActionBundle, Actions, ActionSignatures, ActionSubjects, BlockContext, Profile } from './r-internationale';
import { RILibp2p } from './ri-libp2p';
import debug from 'debug';
import EventEmitter from 'events';

export type PeerJSON = {
  id: string;
  pubKey: string;
  privKey: string;
};

export type RIConfig = {
  my_peer_json: PeerJSON;
  bootstrap_public_key: string;
  port?: number; // p2p 端口，如果不指定，自动选择端口
  enable_dynamic_relay?: boolean;
};

export type Context = {
  pending_block?: BlockContext;
  config: RIConfig;
  ipfs: IIPFS;
  libp2p: RILibp2p;
  db: IDatabase;
  log: (...args) => void;
  port: number;
  p2p_address: string;

  ee: EventEmitter;
  utils: {
    gen_id: () => string;
    random: () => number;
  };
};

export type InitialParams = {
  config: RIConfig;
  initial_timestamp: number;
  initial_action_bundle: ActionBundle;
  initial_action_signatures: ActionSignatures;
  initial_action_subjects: ActionSubjects;
  initial_min_witness_broadcast_window: number;
  initial_min_actions_broadcast_window: number;
};
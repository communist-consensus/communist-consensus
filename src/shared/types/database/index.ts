export * from './cache';
export * from './peer';
export * from './proposal';
export * from './domain';

import { Connection } from 'typeorm';
import { Context, RIConfig } from '..';
import { IPFSAddress } from '../common';
import { BlockchainBlock, BlockContext } from '../r-internationale';
import { IDBCache } from './cache';
import { IDBDomain } from './domain';
import { IDBPeer } from './peer';
import { IDBProposal } from './proposal';

export type DBBlock = {
  min_witness_broadcast_window: number;
  min_actions_broadcast_window: number;
  block_hash: string;
  cycle_id: number;
  witnesses_cid: IPFSAddress,
  witness_signatures_cid: IPFSAddress,
  witness_testimony_cid: IPFSAddress,
} & BlockchainBlock;

export type PendingBlock = {
  min_witness_broadcast_window: number;
  min_actions_broadcast_window: number;
  cycle_id: number;
} & BlockchainBlock;


export type MysqlConfig = {
  host: string;
  user: string;
  password: string;
};

export interface IDatabase {
  connection: Connection;

  domain: IDBDomain;
  cache: IDBCache;
  peer: IDBPeer;
  proposal: IDBProposal;

  ctx: Context;

  init: (ctx: Context, config: MysqlConfig) => Promise<void>;
  close: () => Promise<void>;
  clear: () => Promise<void>;
  reconnect: () => Promise<void>;
  get_block: (block_hash: IPFSAddress) => Promise<DBBlock>;
  get_blocks: (page: number, n?: number) => Promise<{
    blocks: DBBlock[];
    total: number;
    n: number;
  }>;
  get_n_block: () => Promise<number>;
  get_root_block: () => Promise<DBBlock>;
  get_next_block: (block_hash: IPFSAddress) => Promise<DBBlock>;
  get_latest_block: () => Promise<DBBlock>;

  add_blockchain: (block_ctx: BlockContext) => Promise<void>;
}
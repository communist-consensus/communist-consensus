export * from './peer';
export * from './proposal';
export * from './domain';
export * from './block';
export * from './aba';
export * from './rbc';

import { Connection } from 'typeorm';
import { Context, ConsensusConfig } from '..';
import { IDBDomain } from './domain';
import { IDBPeer } from './peer';
import { IDBBlock } from './block';
import { IDBABA } from './aba';
import { IDBProposal } from './proposal';
import { IDBRBC } from './rbc';

export type MysqlConfig = {
  host: string;
  user: string;
  password: string;
};

export interface IDatabase {
  connection: Connection;

  close: () => Promise<void>;
  clear: () => Promise<void>;
  reconnect: () => Promise<void>;
}

export interface IDatabaseManager {
  rbc: IDBRBC;
  domain: IDBDomain;
  peer: IDBPeer;
  proposal: IDBProposal;
  block: IDBBlock;
  aba: IDBABA;
}
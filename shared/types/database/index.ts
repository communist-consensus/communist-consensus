export * from './peer';
export * from './proposal';
export * from './domain';
export * from './block';
export * from './aba';
export * from './rbc';

import { DataSource, QueryRunner } from 'typeorm';
import { Context, ConsensusConfig } from '..';

export type MysqlConfig = {
  host: string;
  user: string;
  password: string;
};

export interface IDatabase {
  datasource: DataSource;

  close: () => Promise<void>;
  clear: () => Promise<void>;
  reconnect: () => Promise<void>;
}
import { IPFSAddress, IDatabase } from '../types';
import { DataSource } from 'typeorm';

import debug from 'debug';
import mysql from 'mysql';
import { validate_mid } from '../simple_validator';
import { PeerId } from '@libp2p/interface-peer-id';

import { Context } from '../../../shared/types';
import env from 'dotenv';
import { db_entities } from './utils';
env.config();

export const createDatabase = async (node_id: string): Promise<IDatabase> => {
  const con = mysql.createConnection({
    host: (process.env as any).DB_HOST,
    user: (process.env as any).DB_USER,
    password: (process.env as any).DB_PASSWORD,
    port: parseInt((process.env as any).DB_PORT),
  });
  const dbName = node_id;
  await new Promise<void>((resolve) =>
    con.connect(function (err) {
      if (err) throw err;
      con.query(
        `CREATE DATABASE IF NOT EXISTS ${dbName} DEFAULT CHARSET utf8 COLLATE utf8_general_ci`,
        function (err, result) {
          if (err) {
            console.error(err);
          }
          con.destroy();
          resolve();
        },
      );
    }),
  );

  const datasource = new DataSource({
    type: 'mysql',
    // debug: true,
    // trace: true,
    name: dbName,
    database: dbName,
    username: (process.env as any).DB_USER,
    host: (process.env as any).DB_HOST,
    password: (process.env as any).DB_PASSWORD,
    port: parseInt((process.env as any).DB_PORT),
    synchronize: true,
    entities: db_entities,
  });

  async function get_entities() {
    return await (await datasource).entityMetadatas;
  };
  await datasource.initialize()
  return {
    datasource,
    async clear() {
      try {
        for (const entity of await get_entities()) {
          const repository = await datasource.getRepository(entity.name);
          await repository.query(`DELETE FROM ${entity.tableName};`);
        }
      } catch (error) {
        throw new Error(`ERROR: ${error}`);
      }
    },

    async reconnect() {
      await datasource.connect();
    },

    async close() {
      await datasource.close();
    },
  };
};
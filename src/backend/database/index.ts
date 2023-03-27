import { IPFSAddress, IDatabase } from '../types';
import { Connection, createConnection } from 'typeorm';

import KV from './entity/kv';
import Block from './entity/block';
import Peer from './entity/peer';
import ABA from './entity/aba';
import RBCVal from './entity/rbc-val';
import RBCEcho from './entity/rbc-echo';
import RBCReady from './entity/rbc-ready';
import ABAPrevote from './entity/aba-prevote';

import debug from 'debug';
import ComputedVote from './entity/computed-vote';
import ConferencePeerPair from './entity/conference-peer-pair';
import ConferenceSolutionPair from './entity/conference-solution-pair';
import Conference from './entity/conference';
import Domain from './entity/domain';
import ProposalComment from './entity/proposal-comment';
import ProposalPeerPair from './entity/proposal-peer-pair';
import ProposalRoundPair from './entity/proposal-round-pair';
import Proposal from './entity/proposal';
import SolutionComment from './entity/solution-comment';
import SolutionTaskPair from './entity/solution-task-pair';
import Solution from './entity/solution';
import Task from './entity/task';
import VoteLog from './entity/vote-log';
import DomainProposalPair from './entity/domain-proposal-pair';
import mysql from 'mysql';
import { validate_mid } from '../simple_validator';
import { PeerId } from '@libp2p/interface-peer-id';

import BlockModel from './block';
import ABAModel from './aba';
import DomainModel from './domain';
import PeerModel from './peer';
import ProposalModel from './proposal';
import RBCModel from './rbc';

import { Context, IDatabaseManager } from '../../../shared/types';
import env from 'dotenv';
env.config();

const createDatabase = async (node_id: string): Promise<IDatabase> => {
  const con = mysql.createConnection({
    host: (process.env as any).DB_HOST,
    user: (process.env as any).DB_USER,
    password: (process.env as any).DB_PASSWORD,
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

  const connection = await createConnection({
    type: 'mysql',
    // debug: true,
    // trace: true,
    name: dbName,
    database: dbName,
    username: (process.env as any).DB_USER,
    host: (process.env as any).DB_HOST,
    password: (process.env as any).DB_PASSWORD,
    synchronize: true,
    entities: [
      KV,
      Block,
      Peer,
      RBCVal,
      RBCReady,
      RBCEcho,
      ComputedVote,
      ConferencePeerPair,
      ConferenceSolutionPair,
      Conference,
      DomainProposalPair,
      Domain,
      ProposalComment,
      ProposalPeerPair,
      ProposalRoundPair,
      Proposal,
      SolutionComment,
      SolutionTaskPair,
      Solution,
      ABA,
      ABAPrevote,
      Task,
      VoteLog,
    ],
  });

  async function get_entities() {
    return await (await connection).entityMetadatas;
  };

  return {
    connection,
    async clear() {
      try {
        for (const entity of await get_entities()) {
          const repository = await connection.getRepository(entity.name);
          await repository.query(`DELETE FROM ${entity.tableName};`);
        }
      } catch (error) {
        throw new Error(`ERROR: ${error}`);
      }
    },

    async reconnect() {
      await connection.connect();
    },

    async close() {
      await connection.close();
    },
  };
};

export default createDatabase;
export const createDBManager = (ctx: Context): IDatabaseManager => ({
  aba: ABAModel(ctx.db.connection.manager),
  block: BlockModel(ctx.db.connection.manager),
  peer: PeerModel(ctx.db.connection.manager),
  domain: DomainModel(ctx.db.connection.manager),
  proposal: ProposalModel(ctx, ctx.db.connection.manager),
  rbc: RBCModel(ctx.db.connection.manager),
});

import { IPFSAddress, IDatabase } from '../types';
import { Connection, createConnection } from 'typeorm';

import KV from './entity/kv';
import Block from './entity/block';
import Peer from './entity/peer';

import debug from 'debug';

import {
  IDBPeer as IDBPeer,
  IDBCache as IDBCache,
  IDBDomain,
  IDBProposal,
  BlockContext,
  RIConfig,
  Context,
  MysqlConfig,
} from '../../shared/types';
import APIDomain from './domain';
import DBPeer from './peer';
import APICache from './cache';
import APIProposal from './proposal';
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
import { DATABASE_CONFIG } from '../../shared/constant';
import { validate_mid } from '../simple_validator';

function normalize(block: Block) {
  block.witness_broadcast_window_end = parseInt(
    (block.witness_broadcast_window_end as unknown) as string,
  );
  block.witness_broadcast_window_start = parseInt(
    (block.witness_broadcast_window_start as unknown) as string,
  );
  block.actions_broadcast_window_start = parseInt(
    (block.actions_broadcast_window_start as unknown) as string,
  );
  block.actions_broadcast_window_end = parseInt(
    (block.actions_broadcast_window_end as unknown) as string,
  );
  return block;
}
export default class DataBase implements IDatabase {
  connection: Connection;

  peer: IDBPeer;
  cache: IDBCache;
  domain: IDBDomain;
  proposal: IDBProposal;

  ctx: Context;

  static async create(ctx: Context, config: MysqlConfig = DATABASE_CONFIG) {
    const db = new DataBase();
    await db.init(ctx, config);
    return db;
  }

  public async init(
    ctx: Context,
    mysql_config: MysqlConfig,
  ) {
    this.ctx = ctx;

    const con = mysql.createConnection(mysql_config);
    await new Promise<void>((resolve) =>
      con.connect(function (err) {
        if (err) throw err;
        if (!validate_mid(ctx.config.my_peer_json.id)) {
          throw new Error('bad mid');
        }
        con.query(
          `CREATE DATABASE IF NOT EXISTS ${ctx.config.my_peer_json.id} DEFAULT CHARSET utf8 COLLATE utf8_general_ci`,
          function (err, result) {
            if (err) {
              ctx.log(err);
            } else {
              ctx.log('Database created');
            }
            con.destroy();
            resolve();
          },
        );
      }),
    );

    this.ctx.log(`create typeorm connection`, mysql_config);
    this.connection = await createConnection({
      type: 'mysql',
      // debug: true,
      // trace: true,
      name: this.ctx.config.my_peer_json.id,
      ...{
        ...mysql_config,
        username: mysql_config.user,
        user: undefined,
        database: this.ctx.config.my_peer_json.id,
      },
      synchronize: true,
      entities: [
        KV,
        Block,
        Peer,
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
        Task,
        VoteLog,
      ],
    });
    this.peer = new DBPeer(this);
    this.cache = new APICache();
    this.domain = new APIDomain(this);
    this.proposal = new APIProposal(this);
  }

  async get_entities() {
    return await (await this.connection).entityMetadatas;
  }

  public async clear() {
    await this.cache.clear_forwarded();
    await this.cache.clear_witness_testimony_cache();
    try {
      for (const entity of await this.get_entities()) {
        const repository = await this.connection.getRepository(entity.name);
        await repository.query(`DELETE FROM ${entity.tableName};`);
      }
    } catch (error) {
      throw new Error(`ERROR: ${error}`);
    }
  }

  public async reconnect() {
    await this.connection.connect();
  }

  public async close() {
    await this.connection.close();
  }

  public async get_next_block(block_hash: IPFSAddress) {
    const next = await this.connection.manager.findOne(Block, {
      prev_block_hash: block_hash,
    });
    return next ? normalize(next) : undefined;
  }

  public async get_root_block() {
    const block = await this.connection.manager.findOne(Block, { cycle_id: 0 });
    return block ? normalize(block) : undefined;
  }

  public async get_block(block_hash: IPFSAddress) {
    const block = await this.connection.manager.findOne(Block, { block_hash });
    return block ? normalize(block) : undefined;
  }

  public async get_blocks(page: number, n = 10) {
    const [blocks, total] = await this.connection.manager.findAndCount(Block, {
      take: n,
      skip: n * (page - 1),
      order: {
        cycle_id: 'ASC',
      },
    });
    return {
      blocks: blocks.map((i) => normalize(i)),
      total,
      n,
    };
  }

  public async get_latest_block() {
    const blocks = await this.connection.manager.find(Block, {
      order: {
        cycle_id: 'DESC',
      },
      take: 1,
    });
    return blocks.length ? normalize(blocks[0]) : undefined;
  }

  public async get_n_block() {
    const count = await this.connection.manager.count(Block);
    return count;
  }

  public async add_blockchain(block_ctx: BlockContext) {
    await this.connection.manager.insert(Block, {
      min_witness_broadcast_window: block_ctx.min_witness_broadcast_window,
      min_actions_broadcast_window: block_ctx.min_actions_broadcast_window,
      block_hash: block_ctx.block_hash,
      cycle_id: block_ctx.cycle_id,
      prev_block_hash: block_ctx.prev_block_hash,
      n_peer: block_ctx.n_peer,
      witness_broadcast_window_end: block_ctx.witness_broadcast_window_end,
      witness_broadcast_window_start: block_ctx.witness_broadcast_window_start,
      actions_broadcast_window_end: block_ctx.actions_broadcast_window_end,
      actions_broadcast_window_start: block_ctx.actions_broadcast_window_start,
      witnesses_cid: block_ctx.final_witnesses_cid,
      witness_signatures_cid: block_ctx.final_witness_signatures_cid,
      action_bundle_cid: block_ctx.action_bundle_cid,
      action_subjects_cid: block_ctx.action_subjects_cid,
      action_signatures_cid: block_ctx.action_signatures_cid,
      witness_testimony_cid: block_ctx.final_witness_testimony_cid,
    });
  }
}

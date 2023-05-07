import Block from './entity/block';
import { IPFSAddress, IDatabase, DBBlock } from '../types';
import { EntityManager, QueryRunner } from 'typeorm';

export async function get_root_block(manager: EntityManager) {
  const block = await manager.findOne(Block, {
    where: {
      epoch: 0,
    },
  });
  return block;
}

export async function get_block(manager: EntityManager, cid: IPFSAddress<DBBlock>) {
  const block = await manager.findOne(Block, {
    where: {
      block_cid: cid,
    },
  });
  return block;
}

export async function get_blocks(manager: EntityManager) {
  return await manager.find(Block, {});
}

export async function get_latest_block(manager: EntityManager) {
  const blocks = await manager.find(Block, {
    order: {
      epoch: 'DESC',
    },
    take: 1,
  });
  return blocks.length ? blocks[0] : undefined;
}

export async function get_n_block(manager) {
  const count = await manager.count(Block);
  return count;
}

export async function get_next_block(manager: EntityManager, cid: IPFSAddress<DBBlock>) {
  const next = await manager.findOne(Block, {
    where: {
      prev_block_cid: cid,
    },
  });
  return next;
}

export async function add_block(manager: EntityManager, block: DBBlock) {
  await manager.insert(Block, block);
}

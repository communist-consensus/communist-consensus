import Block from './entity/block';
import { BlockContext, IDBBlock } from '../../../shared/types';
import { IPFSAddress, IDatabase } from '../types';
import { EntityManager } from 'typeorm';

export default (manager: EntityManager): IDBBlock => ({
  async get_root_block() {
    const block = await manager.findOne(Block, { epoch: 0 });
    return block;
  },

  async get_block(block_hash: IPFSAddress) {
    const block = await manager.findOne(Block, { block_hash });
    return block;
  },

  async get_blocks() {
    return await manager.find(Block, {});
  },

  async get_latest_block() {
    const blocks = await manager.find(Block, {
      order: {
        epoch: 'DESC',
      },
      take: 1,
    });
    return blocks.length ? blocks[0] : undefined;
  },

  async get_n_block() {
    const count = await manager.count(Block);
    return count;
  },

  async add_block(block_ctx: BlockContext) {
    await manager.insert(Block, {
      block_hash: block_ctx.block_hash,
      epoch: block_ctx.epoch,
      prev_block_hash: block_ctx.prev_block_hash,
    });
  },

  async get_next_block(block_hash: IPFSAddress) {
    const next = await manager.findOne(Block, {
      prev_block_hash: block_hash,
    });
    return next;
  },
});

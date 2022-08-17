import PeerId from 'peer-id';

import * as simple_validator from '../simple_validator';

import { verify_block, apply_block } from './apply_block';
import {
  hash_to_number,
  get_now,
  shuffle_n_array,
  sort_n_array,
  sleep,
  hash_signatures,
  encode,
  RSA_sign,
  decode,
  get_intersection_actions,
  uint8array_to_b58,
} from '../utils';
import {
  MID_B58,
  WitnessTestimony,
  Actions,
  BlockContext,
  BlockCtxState,
  RIPeerEvent,
  ActionSubjects,
  ActionBundle,
  BlockchainBlock,
  MID,
  ActionsTestimony,
  IDatabase,
} from '../types';
import apply_actions from './apply_actions';
import EventEmitter from 'events';
import {
  ActionSignatures,
  Context,
  DBBlock,
  IPFSAddress,
  NextBlockhashResCode,
  ResRequestNextBlock,
} from '../../shared/types';
import { AHEAD_OF_ROOT_BLOCK, AHEAD_OF_ROOT_BLOCK2 } from '../../shared/constant';
import {
  compute_actions_broadcast_duration,
  compute_witness_broadcast_duration,
} from '../../shared/utils';

export default class BlockChain extends EventEmitter {
  private peer_id: PeerId;
  private mid: MID;
  private mid_b58: MID_B58;

  ctx: Context;
  db: IDatabase;

  actions_cache: Actions = [];

  private ipfs_empty_arr: IPFSAddress;

  static async create(ctx: Context) {
    const blockchain = new BlockChain();
    await blockchain.init(ctx);
    return blockchain;
  }

  private stopped = false;
  private n_pending_promise = 0;
  private async make_cancelable<T>(t: Promise<T>) {
    this.n_pending_promise++;
    try {
      const res = await t;
      this.n_pending_promise--;
      if (this.stopped) {
        throw new Error('stopped');
      }
      return res;
    } catch (e) {
      this.ctx.log(e);
    }
  }

  private async sleep_second(t: number) {
    await this.make_cancelable(sleep(t * 1000));
  }

  private create_block_ctx(
    block?: DBBlock,
    witness_testimony?: WitnessTestimony,
  ): BlockContext {
    const ctx: BlockContext = {
      block_hash: undefined,
      prev_block_hash: undefined,
      cycle_id: undefined,
      min_witness_broadcast_window: 0,
      min_actions_broadcast_window: 0,
      actions_broadcast_window_start: 0,
      actions_broadcast_window_end: 0,
      witness_broadcast_window_start: 0,
      witness_broadcast_window_end: 0,
      action_bundle_cid: this.ipfs_empty_arr,
      action_signatures_cid: this.ipfs_empty_arr,
      action_subjects_cid: this.ipfs_empty_arr,

      temp_signature_cid: '',
      temp_signature_for_final_witness_testimony_cid: undefined,

      final_witnesses_cid: '',
      final_witness_testimony_cid: '',
      final_witness_signatures_cid: '',

      // 区块生成之前的临时数据
      actions_broadcast_timestamp: undefined,
      witness_broadcast_timestamp: undefined,
      state: BlockCtxState.inactive,
      actions_broadcasted: false,
      n_tries: 0,
      actions: [],
      action_bundle: [],
      action_signatures: [],
      action_subjects: [],
      // 用于计算广播时长

      // 该区块运行前的 n_peer，ab期间的n_peer与wb期间的n_peer可能不同（都是取前一个刚确认的区块的n_peer)
      n_peer: 0,
      witnesses: [],
      witness_signatures: [],
      witness_testimony_cids: [],
    };
    if (block && witness_testimony) {
      ctx.block_hash = block.block_hash;
      ctx.min_witness_broadcast_window = block.min_witness_broadcast_window;
      ctx.min_actions_broadcast_window = block.min_actions_broadcast_window;
      ctx.prev_block_hash = block.prev_block_hash;
      ctx.cycle_id = block.cycle_id;
      ctx.actions_broadcast_window_start =
        witness_testimony.actions_broadcast_window_start;
      ctx.actions_broadcast_window_end =
        witness_testimony.actions_broadcast_window_end;
      ctx.witness_broadcast_window_start =
        witness_testimony.witness_broadcast_window_start;
      ctx.witness_broadcast_window_end =
        witness_testimony.witness_broadcast_window_end;
      ctx.action_bundle_cid = block.action_bundle_cid;
      ctx.action_signatures_cid = block.action_signatures_cid;
      ctx.action_subjects_cid = block.action_subjects_cid;
      ctx.final_witnesses_cid = block.witnesses_cid;
      ctx.final_witness_testimony_cid = block.witness_testimony_cid;
      ctx.final_witness_signatures_cid = block.witness_signatures_cid;
      ctx.n_peer = block.n_peer;
      ctx.state = BlockCtxState.witness_broadcast_end;
    }
    return ctx;
  }

  private async broadcast_actions_testimony(
    block_ctx: BlockContext,
    at: ActionsTestimony,
  ) {
    const signature = await RSA_sign(this.peer_id.privKey, encode(at));
    block_ctx.action_bundle.push(block_ctx.actions);
    block_ctx.action_subjects.push(this.mid_b58);
    block_ctx.action_signatures.push(
      await this.RSA_sign(this.peer_id.privKey, encode(at)),
    );
    await this.make_cancelable(
      this.ctx.libp2p.consensus_protocol.broadcast_actions_testimony(
        at,
        signature,
      ),
    );
  }

  private async get_witness_testimony_cache() {
    return await this.make_cancelable(
      this.db.cache.get_witness_testimony_cache(),
    );
  }
  private async clear_cache() {
    await this.make_cancelable(this.db.cache.clear_witness_testimony_cache());
  }
  private async RSA_sign(private_key, data: Uint8Array) {
    return await this.make_cancelable(RSA_sign(private_key, data));
  }

  private async get_intersection_actions(block_ctx: BlockContext) {
    return await this.make_cancelable(
      get_intersection_actions(
        this.ctx,
        block_ctx.prev_block_hash === AHEAD_OF_ROOT_BLOCK
          ? AHEAD_OF_ROOT_BLOCK2
          : block_ctx.prev.prev_block_hash,
        block_ctx.prev_block_hash,
        block_ctx.witnesses,
        block_ctx.witness_testimony_cids,
        block_ctx.witness_signatures,
        block_ctx.actions_broadcast_window_start,
      ),
    );
  }

  private async do_forward_witness_testimony(
    args: Uint8Array,
    src: Uint8Array,
    n_peer: number,
  ) {
    await this.make_cancelable(
      this.ctx.libp2p.consensus_protocol.do_forward_witness_testimony(
        args,
        src,
        n_peer,
      ),
    );
  }

  private async update_witness_testimony(
    block_ctx: BlockContext,
    n_tries: number,
  ) {
    this.envelop_actions(block_ctx);
    block_ctx.action_bundle_cid = await this.ctx.ipfs.add(
      block_ctx.action_bundle,
    );
    block_ctx.action_subjects_cid = await this.ctx.ipfs.add(
      block_ctx.action_subjects,
    );
    block_ctx.action_signatures_cid = await this.ctx.ipfs.add(
      block_ctx.action_signatures,
    );
    const testimony: WitnessTestimony = {
      prev_block_hash: block_ctx.prev_block_hash,
      min_witness_broadcast_window: block_ctx.min_witness_broadcast_window,
      min_actions_broadcast_window: block_ctx.min_actions_broadcast_window,
      n_tries,
      actions_broadcast_window_start: block_ctx.actions_broadcast_window_start,
      actions_broadcast_window_end: block_ctx.actions_broadcast_window_end,
      witness_broadcast_window_start: block_ctx.witness_broadcast_window_start,
      witness_broadcast_window_end: block_ctx.witness_broadcast_window_end,
      action_bundle_cid: block_ctx.action_bundle_cid,
      action_signatures_cid: block_ctx.action_signatures_cid,
      action_subjects_cid: block_ctx.action_subjects_cid,
    };
    block_ctx.final_witness_testimony_cid = await this.ipfs_add(testimony);
    block_ctx.temp_signature_for_final_witness_testimony_cid = await RSA_sign(
      this.ctx.libp2p.peerId.privKey,
      encode(block_ctx.final_witness_testimony_cid),
    );
    block_ctx.temp_signature_cid = await this.ctx.ipfs.add(
      block_ctx.temp_signature_for_final_witness_testimony_cid,
    );
  }

  private async broadcast_witness_testimony(
    testimony_cid: string,
    signature: Uint8Array,
  ) {
    this.ctx.log(
      'broadcast witness testimony',
      testimony_cid,
      (await this.ctx.ipfs.get<WitnessTestimony>(testimony_cid))
        .actions_broadcast_window_end,
    );
    await this.make_cancelable(
      this.ctx.libp2p.consensus_protocol.broadcast_witness_testimony(
        testimony_cid,
        signature,
      ),
    );
  }

  private async ipfs_add(content: any) {
    return await this.make_cancelable(this.ctx.ipfs.add(content));
  }

  private async ipfs_get<T>(addr: string) {
    return (await this.make_cancelable(this.ctx.ipfs.get(addr))) as T;
  }

  private async ipfs_get_cid(content: string | Uint8Array) {
    return await this.make_cancelable(this.ctx.ipfs.get_cid(content));
  }

  private async init(ctx: Context) {
    this.ctx = ctx;
    this.db = ctx.db;

    this.peer_id = ctx.libp2p.peerId;
    this.mid = this.peer_id.id;
    this.mid_b58 = uint8array_to_b58(this.mid);

    this.ipfs_empty_arr = await this.ctx.ipfs.add([]);
    function log_ctx(block_ctx: BlockContext) {
      return {
        actions: block_ctx.actions,
      };
    }
    this.on(RIPeerEvent.witness_broadcast_end, (block_ctx: BlockContext) => {
      this.ctx.log(`witness broadcast end`, block_ctx.action_bundle);
    });
    this.on(RIPeerEvent.actions_broadcast_end, (block_ctx: BlockContext) => {
      this.ctx.log(`actions broadcast end`, log_ctx(block_ctx));
    });
  }

  envelop_actions(block_ctx: BlockContext) {
    // 先按 mid 排序
    [
      block_ctx.action_subjects,
      block_ctx.action_signatures,
      block_ctx.action_bundle,
    ] = sort_n_array(
      [
        block_ctx.action_subjects,
        block_ctx.action_signatures,
        block_ctx.action_bundle,
      ],
      (a, b) => a[0] - b[0],
    );
    // 再按 hash 乱序
    [
      block_ctx.action_subjects,
      block_ctx.action_signatures,
      block_ctx.action_bundle,
    ] = shuffle_n_array(
      [
        block_ctx.action_subjects,
        block_ctx.action_signatures,
        block_ctx.action_bundle,
      ],
      hash_to_number(hash_signatures(block_ctx.action_signatures)),
    );
  }

  /**
   * 初始化时每个节点的配置需一致
   */
  public async start(
    opt: {
      initial_timestamp: number;
      initial_action_bundle: ActionBundle;
      initial_action_signatures: ActionSignatures;
      initial_action_subjects: ActionSubjects;
      initial_min_witness_broadcast_window: number;
      initial_min_actions_broadcast_window: number;
    } = undefined,
  ) {
    this.ctx.log('start', opt);
    // 保证没有 actions_broadcast event 和 witness_broadcast event 正在运行
    while (this.n_pending_promise) {
      await sleep(1000);
    }

    if (opt) {
      this.ctx.log('mode: initiator');

      const now = opt.initial_timestamp;

      // TODO 验证签名
      // 第一个区块特殊处理
      await apply_actions(
        this.ctx,
        opt.initial_action_bundle,
        opt.initial_action_subjects,
        now,
        now,
        AHEAD_OF_ROOT_BLOCK,
      );
      await this.db.add_blockchain({
        ...this.create_block_ctx(),
        min_witness_broadcast_window: opt.initial_min_witness_broadcast_window,
        min_actions_broadcast_window: opt.initial_min_actions_broadcast_window,
        cycle_id: -1,
        block_hash: AHEAD_OF_ROOT_BLOCK,
        prev_block_hash: AHEAD_OF_ROOT_BLOCK2,
        witness_broadcast_window_end: now,
      });

      // 首次运行
      const first_block: BlockContext = {
        ...this.create_block_ctx(),
        min_witness_broadcast_window: opt.initial_min_witness_broadcast_window,
        min_actions_broadcast_window: opt.initial_min_actions_broadcast_window,
        cycle_id: 0,
        n_peer: 2, // 需要两个节点完成初始化
        prev_block_hash: AHEAD_OF_ROOT_BLOCK,
        actions_broadcast_window_start: now,
        actions_broadcast_window_end: now,
        witness_broadcast_window_start: now,
        witness_broadcast_window_end: now,
        action_bundle_cid: await this.ipfs_add([]),
        action_signatures_cid: await this.ipfs_add([]),
        action_subjects_cid: await this.ipfs_add([]),
        state: BlockCtxState.actions_broadcast_end,
      };
      const second_block: BlockContext = {
        ...this.create_block_ctx(),
        min_witness_broadcast_window: opt.initial_min_witness_broadcast_window,
        min_actions_broadcast_window: opt.initial_min_actions_broadcast_window,
        cycle_id: 1,
        n_peer: 2,
        actions_broadcast_window_start: now,
        actions_broadcast_window_end: now,
        state: BlockCtxState.actions_broadcast_end,
        prev: first_block,
      };

      first_block.next = second_block;

      this.emit_internal_witness_broadcast_start(first_block);
    } else {
      const actions = this.ctx.pending_block ? this.ctx.pending_block.next.actions : [];
      const pending_block = await this.sync_blockchain();
      const latest_block = await this.db.get_latest_block();
      if (!latest_block) {
        this.ctx.log('no latest block');
        return;
      }
      this.ctx.log(
        'mode: resume',
        pending_block.cycle_id,
        latest_block.cycle_id,
      );

      let witness_testimony: WitnessTestimony;
      if (latest_block.block_hash === AHEAD_OF_ROOT_BLOCK) {
        witness_testimony = { ...this.create_block_ctx() };
      } else {
        witness_testimony = await this.ipfs_get<WitnessTestimony>(
          latest_block.witness_testimony_cid,
        );
      }

      const prev: BlockContext = this.create_block_ctx(
        latest_block,
        witness_testimony,
      );

      const n_peer = await this.ctx.db.peer.get_n_known_peers();
      prev.next = {
        ...this.create_block_ctx(),
        ...pending_block,
        prev_block_hash: prev.block_hash,
        n_peer,
        state: BlockCtxState.actions_broadcast_end,
        actions_broadcasted: true,
        prev,
      };
      prev.next.next = {
        ...this.create_block_ctx(),
        actions,
        min_witness_broadcast_window:
          pending_block.min_witness_broadcast_window,
        min_actions_broadcast_window:
          pending_block.min_actions_broadcast_window,
        cycle_id: pending_block.cycle_id + 1,
        actions_broadcast_window_start: prev.witness_broadcast_window_end,
        state: BlockCtxState.actions_broadcast_start,
        prev: prev.next,
        n_peer,
      };

      this.emit_internal_witness_broadcast_start(prev.next);
      this.emit_internal_actions_broadcast_start(prev.next.next);
    }
  }

  async on_internal_actions_broadcast_start(block_ctx: BlockContext) {
    while (
      block_ctx.prev.state !== BlockCtxState.witness_broadcast_start &&
      block_ctx.prev.state !== BlockCtxState.witness_broadcast_end
    ) {
      await this.sleep_second(0.1);
    }
    this.emit(RIPeerEvent.actions_broadcast_start, block_ctx);
    this.ctx.log(`on actions broadcast start`);
    const {
      actions_broadcast_duration,
      estimated_transmission_duration,
      estimated_time_error,
    } = compute_actions_broadcast_duration(
      block_ctx.min_actions_broadcast_window,
      block_ctx.n_peer,
    );
    block_ctx.state = BlockCtxState.actions_broadcast_start;
    block_ctx.actions_broadcast_timestamp =
      block_ctx.actions_broadcast_window_start +
      actions_broadcast_duration * Math.random() +
      estimated_time_error;
    block_ctx.actions_broadcast_window_end =
      actions_broadcast_duration +
      block_ctx.actions_broadcast_window_start +
      2 * estimated_time_error +
      estimated_transmission_duration;
    const now = get_now();
    const sleep_time = block_ctx.actions_broadcast_timestamp - now;
    if (now > block_ctx.actions_broadcast_window_end) {
      block_ctx.actions_broadcasted = true;
      block_ctx.state = BlockCtxState.actions_broadcast_end;
      this.actions_cache = this.actions_cache.concat(block_ctx.actions);
      block_ctx.actions = [];
      return;
    }
    await this.sleep_second(sleep_time);
    block_ctx.actions_broadcasted = true;
    block_ctx.actions = block_ctx.actions.concat(this.actions_cache);
    this.actions_cache = [];
    this.emit(RIPeerEvent.before_actions_broadcast, block_ctx);
    if (block_ctx.actions.length) {
      await this.broadcast_actions_testimony(block_ctx, {
        before_prev_block_hash: block_ctx.prev.prev_block_hash,
        actions: block_ctx.actions,
        start_timestamp: block_ctx.actions_broadcast_window_start,
        mid: this.peer_id.toB58String(),
      });
    }
    await this.sleep_second(block_ctx.actions_broadcast_window_end - get_now());
    block_ctx.state = BlockCtxState.actions_broadcast_end;
    this.emit(RIPeerEvent.actions_broadcast_end, block_ctx);
  }

  async on_internal_witness_broadcast_start(block_ctx: BlockContext) {
    while (
      (block_ctx.prev &&
        block_ctx.prev.state !== BlockCtxState.witness_broadcast_end) ||
      block_ctx.state !== BlockCtxState.actions_broadcast_end
    ) {
      await this.sleep_second(0.1);
    }

    this.ctx.pending_block = block_ctx;

    const final_witness_testimony_cid_cb = (cid: string) => {
      block_ctx.final_witness_testimony_cid = cid;
      block_ctx.state = BlockCtxState.witness_broadcast_end;
    };

    this.ctx.ee.once(
      RIPeerEvent.internal_final_witness_testimony_cid,
      final_witness_testimony_cid_cb,
    );

    this.emit(RIPeerEvent.witness_broadcast_start, block_ctx);
    this.ctx.log(`on witness broadcast start`);
    block_ctx.state = BlockCtxState.witness_broadcast_start;
    block_ctx.witness_broadcast_window_start =
      block_ctx.actions_broadcast_window_end;
    while (true) {
      block_ctx.state = BlockCtxState.witness_broadcast_start;
      while (true) {
        let res: ResRequestNextBlock;
        try {
          res = await this.ctx.libp2p.consensus_protocol.request_next_block({
            random_addr: true,
            block_hash: block_ctx.prev_block_hash,
          });
        } catch (e) {
          this.ctx.log('warn: no enough connections');
          await this.sleep_second(2);
          continue;
        }
        if (!simple_validator.validate_res_request_next_block(res)) {
          this.ctx.log('warn: invalid res');
          await this.sleep_second(2);
          continue;
        }
        if (
          res.code === NextBlockhashResCode.notReady ||
          res.code === NextBlockhashResCode.reqBlockNotExists
        ) {
          this.ctx.log('warn: request next failed1', res);
          await this.sleep_second(2);
          continue;
        }
        if (res.code === NextBlockhashResCode.nextBlockNotExists) {
          break;
        }
        if (res.code === NextBlockhashResCode.ok) {
          // 其他成员已经打包新 block
          // 取消 witness broadcast event（当前只有一个）
          // 取消/等待结束 actions broadcast event（block 不匹配，广播出去也是无效的）
          // 同步至最新的 block hash，重新开始
          this.ctx.ee.off(
            RIPeerEvent.internal_final_witness_testimony_cid,
            final_witness_testimony_cid_cb,
          );
          this.start();
          return;
        } else {
          await this.sleep_second(2);
          this.ctx.log('warn: request next failed2', res);
        }
      }

      const {
        n_tries,
        witness_broadcast_duration,
        witness_broadcast_window_start,
        estimated_transmission_duration,
        estimated_time_error,
      } = compute_witness_broadcast_duration(
        block_ctx.min_witness_broadcast_window,
        block_ctx.n_peer,
        block_ctx.cycle_id === 0
          ? block_ctx.actions_broadcast_window_end
          : block_ctx.prev.witness_broadcast_window_end,
      );
      block_ctx.n_tries = n_tries;
      block_ctx.witness_broadcast_window_start = witness_broadcast_window_start;

      this.ctx.log(`on witness broadcast start:n_tries:${n_tries}`);
      if (n_tries > 0) {
        this.emit(RIPeerEvent.witness_broadcast_retry, block_ctx, n_tries);

        // 求 actions 交集
        const {
          action_bundle,
          action_signatures,
          action_subjects,
        } = await this.get_intersection_actions(block_ctx);
        const idx = block_ctx.action_subjects.find((i) => i === this.mid_b58);
        if (
          idx &&
          !action_subjects.find((i) => i === this.mid_b58)
        ) {
          this.add_actions(block_ctx.action_bundle[idx]);
        }
        block_ctx.action_bundle = action_bundle;
        block_ctx.action_subjects = action_subjects;
        block_ctx.action_signatures = action_signatures;
      }
      block_ctx.witness_broadcast_window_end =
        block_ctx.witness_broadcast_window_start +
        witness_broadcast_duration +
        2 * estimated_time_error +
        estimated_transmission_duration;
      block_ctx.witness_broadcast_timestamp =
        witness_broadcast_duration * Math.random() +
        block_ctx.witness_broadcast_window_start +
        estimated_time_error;

      await this.update_witness_testimony(block_ctx, n_tries);
      await this.ctx.db.cache.set_witness_testimony_forwarded(
        block_ctx.final_witness_testimony_cid,
        this.ctx.libp2p.peerId.toB58String(),
        block_ctx.temp_signature_cid,
        block_ctx.temp_signature_for_final_witness_testimony_cid,
      );
      await this.sleep_second(
        block_ctx.witness_broadcast_timestamp - get_now(),
      );

      const testimony_cache = await this.get_witness_testimony_cache();
      this.ctx.log('cache', testimony_cache.size);
      for (const [mid, cache] of testimony_cache) {
        const { witness_testimony } = cache;
        if (
          witness_testimony.action_bundle_cid === block_ctx.action_bundle_cid &&
          witness_testimony.action_signatures_cid ===
            block_ctx.action_signatures_cid &&
          witness_testimony.action_subjects_cid ===
            block_ctx.action_subjects_cid &&
          witness_testimony.n_tries === n_tries &&
          witness_testimony.actions_broadcast_window_start ===
            block_ctx.actions_broadcast_window_start &&
          witness_testimony.actions_broadcast_window_end ===
            block_ctx.actions_broadcast_window_end &&
          witness_testimony.prev_block_hash === block_ctx.prev_block_hash &&
          witness_testimony.witness_broadcast_window_start ===
            block_ctx.witness_broadcast_window_start &&
          witness_testimony.witness_broadcast_window_end ===
            block_ctx.witness_broadcast_window_end
        ) {
          await this.do_forward_witness_testimony(
            cache.args,
            cache.src,
            block_ctx.n_peer,
          );
        }
      }
      await this.clear_cache();
      await this.broadcast_witness_testimony(
        block_ctx.final_witness_testimony_cid,
        block_ctx.temp_signature_for_final_witness_testimony_cid,
      );

      await this.sleep_second(
        block_ctx.witness_broadcast_window_end - get_now(),
      );

      this.emit(RIPeerEvent.witness_broadcast_before_end, block_ctx, n_tries);
      if ((block_ctx as any).state === BlockCtxState.witness_broadcast_end) {
        const {
          witness_signature_cids,
          witnesses,
        } = await this.db.cache.get_witnesses_and_signature_cids(
          block_ctx.final_witness_testimony_cid,
        );
        block_ctx.witness_testimony_cids = this.db.cache.witness_testimony_forwarded_flat.witness_testimony_cids;
        block_ctx.witnesses = this.db.cache.witness_testimony_forwarded_flat.witnesses;
        block_ctx.witness_signatures = this.db.cache.witness_testimony_forwarded_flat.witness_signatures;
        block_ctx.final_witness_signatures_cid = await this.ipfs_add(
          witness_signature_cids,
        );
        block_ctx.final_witnesses_cid = await this.ipfs_add(witnesses);
        await this.db.cache.clear_forwarded();
        break;
      }
      block_ctx.witness_testimony_cids = this.db.cache.witness_testimony_forwarded_flat.witness_testimony_cids;
      block_ctx.witnesses = this.db.cache.witness_testimony_forwarded_flat.witnesses;
      block_ctx.witness_signatures = this.db.cache.witness_testimony_forwarded_flat.witness_signatures;
      await this.db.cache.clear_forwarded();

      block_ctx.witness_broadcast_window_start =
        block_ctx.witness_broadcast_window_end;
    }

    this.emit(RIPeerEvent.witness_broadcast_end, block_ctx);
    block_ctx.block_hash = await this.ipfs_add(
      encode({
        prev_block_hash: block_ctx.prev_block_hash,
        actions_broadcast_window_start:
          block_ctx.actions_broadcast_window_start,
        witness_broadcast_window_end: block_ctx.witness_broadcast_window_end,
        action_bundle_cid: block_ctx.action_bundle_cid,
        action_signatures_cid: block_ctx.action_signatures_cid,
        action_subjects_cid: block_ctx.action_subjects_cid,
        n_peer: block_ctx.n_peer,
      } as BlockchainBlock),
    );
    await this.db.cache.clear_forwarded();

    await apply_actions(
      this.ctx,
      block_ctx.action_bundle,
      block_ctx.action_subjects,
      block_ctx.actions_broadcast_window_start,
      block_ctx.witness_broadcast_window_end,
      block_ctx.prev_block_hash,
    );
    await this.db.add_blockchain(block_ctx);

    // TODO 事务 & apply_actions 到 写入数据库期间不执行其他任务
    this.emit(RIPeerEvent.after_apply_actions, block_ctx);

    const n_peer = await this.ctx.db.peer.get_n_known_peers();
    if (block_ctx.prev && block_ctx.prev.prev) {
      block_ctx.prev.prev = undefined;
    }
    block_ctx.next.prev_block_hash = block_ctx.block_hash;
    block_ctx.next.min_witness_broadcast_window =
      block_ctx.min_witness_broadcast_window;
    block_ctx.next.min_actions_broadcast_window =
      block_ctx.min_actions_broadcast_window;
    block_ctx.next.n_peer = n_peer;

    block_ctx.next.next = {
      ...this.create_block_ctx(),
      min_witness_broadcast_window: block_ctx.min_witness_broadcast_window,
      min_actions_broadcast_window: block_ctx.min_actions_broadcast_window,
      prev: block_ctx.next,
      n_peer, // 仅用于广播参数的计算
      cycle_id: block_ctx.next.cycle_id + 1,
      state: BlockCtxState.actions_broadcast_start,
      actions_broadcast_window_start: block_ctx.witness_broadcast_window_end,
    };

    this.emit(RIPeerEvent.witness_broadcast_start_finished, block_ctx);

    this.ctx.ee.off(
      RIPeerEvent.internal_final_witness_testimony_cid,
      final_witness_testimony_cid_cb,
    );

    this.emit_internal_witness_broadcast_start(block_ctx.next);
    this.emit_internal_actions_broadcast_start(block_ctx.next.next);
  }

  async emit_internal_witness_broadcast_start(block_ctx: BlockContext) {
    return await this.make_cancelable(
      this.on_internal_witness_broadcast_start(block_ctx),
    );
  }
  async emit_internal_actions_broadcast_start(block_ctx: BlockContext) {
    return await this.make_cancelable(
      this.on_internal_actions_broadcast_start(block_ctx),
    );
  }

  public async sync_blockchain() {
    try {
      while (true) {
        const latest_block = await this.ctx.db.get_latest_block();

        let res: ResRequestNextBlock;
        try {
          res = await this.ctx.libp2p.consensus_protocol.request_next_block({
            random_addr: true,
            block_hash: latest_block.block_hash,
          });
        } catch (e) {
          this.ctx.log(e);
          await sleep(1000);
          continue;
        }
        if (!simple_validator.validate_res_request_next_block(res)) {
          this.ctx.log('sync block:warn: invalid res');
          await this.sleep_second(2);
          continue;
        }
        if (res.code === NextBlockhashResCode.ok) {
          const { next, pending_block } = res;
          if (!pending_block) {
            this.ctx.log('sync block:warn: invalid res: no pending block');
            continue;
          }
          const next_witness_testimony = await this.ipfs_get<WitnessTestimony>(
            next.witness_testimony_cid,
          );
          if (
            latest_block.block_hash !== next_witness_testimony.prev_block_hash
          ) {
            this.ctx.log('sync block:warn: invalid res');
            continue;
          }
          const next_ipfs_block = decode<BlockchainBlock>(
            await this.ipfs_get(next.block_hash),
          );

          if (
            !(await verify_block(
              this.ctx,
              next_ipfs_block,
              next.witness_signatures_cid,
              next.witnesses_cid,
              next.witness_testimony_cid,
              next_witness_testimony,
            ))
          ) {
            this.ctx.log('sync block:warn: invalid block');
            continue;
          }
          await apply_block(this.ctx, next_ipfs_block);
          this.ctx.log('sync block:add block', next.block_hash);
          await this.ctx.db.add_blockchain(
            this.create_block_ctx(next, next_witness_testimony),
          );
          return pending_block;
        } else if (res.code === NextBlockhashResCode.nextBlockNotExists) {
          break;
        } else {
          this.ctx.log('sync block:warn: sync failed', res);
          await sleep(2000);
        }
      }
    } catch (e) {
      this.ctx.log(e);
      // 如果更新失败，回滚
      // TODO
      // random seed
    }
    // TODO 事务commit
  }

  public add_actions(actions: Actions) {
    this.actions_cache.push(...actions);
  }

  public async stop() {
    this.stopped = true;
    while (this.n_pending_promise) {
      await sleep(1000);
    }
    // 清除临时数据
    await this.db.cache.clear_witness_testimony_cache();
    await this.db.cache.clear_forwarded();

    await this.ctx.libp2p.stop();
    await sleep(1000);
    await this.ctx.db.close();
    await this.ctx.ipfs.stop();
  }

  public async resume() {
    await this.ctx.ipfs.start();
    await this.ctx.db.reconnect();
    await this.ctx.libp2p.start();
    this.stopped = false;
  }
}

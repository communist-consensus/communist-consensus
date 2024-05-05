import { EventEmitter } from 'tsee';
import { PeerId } from '@libp2p/interface-peer-id';
import assert from 'assert';
import {
  ABAFinalVoteMessage,
  ABAMainVoteMessage,
  ABAMessage,
  ABAPreVoteMessage,
  ABAProtocols,
  ABAProtocolStage as ABAProtocolStage,
  ABAVoteMessage,
  Context,
  DBBlock,
  IDHTBroadcastHandler,
  IDHTHelper,
  IPFSAddress,
  NodeID,
  Signature,
  SubProtocols,
} from '../types';
import * as peer_store from '../database/peer';
import * as aba_store from '../database/aba';
import {
  ABAValue,
  ABABooleanValue as ABABooleanValue,
  IABAEvents,
} from '../types';
import { decode, encode, sign, verify } from '../utils';
import { DataSource, DataSourceOptions, EntityManager } from 'typeorm';
import { sub_transation } from '../database/utils';
import { Sign } from 'crypto';

const stage_to_code = {
  [ABAProtocolStage.ABA_PREVOTE]: 0,
  [ABAProtocolStage.ABA_VOTE]: 1,
  [ABAProtocolStage.ABA_MAINVOTE]: 2,
  [ABAProtocolStage.ABA_FINALVOTE]: 3,
};
function stage_compare(a: ABAProtocolStage, b: ABAProtocolStage) {
  if (a === b) return 0;
  return stage_to_code[a] - stage_to_code[b];
}

async function get_aba_data_from_raw(
  manager: EntityManager,
  epoch: number,
  sender: NodeID,
  encoded_msg: Uint8Array,
  signature: Uint8Array,
) {
  assert(encoded_msg && signature, 'unknown msg');
  let data: ABAMessage;
  try {
    data = await decode<ABAMessage>(encoded_msg);
  } catch (e) {
    console.warn('decode failed', encoded_msg);
    throw new Error('unable to decode');
  }

  if (
    !(await verify(
      await peer_store.get_pubkey(manager, sender.toString()),
      encoded_msg,
      signature,
    ))
  ) {
    debugger;
    throw new Error('bad signature');
  }

  if (!data || data.epoch !== epoch) {
    debugger;
    throw new Error('bad epoch');
  }

  return data;
}

/**
 * 每个实例保证关于session_id的aba输出boolean值是一致的
 *
 * 每个节点必须等待所有session_id都结束才能结束，所以ABA协议可以不使用多线程
 */
export default async function createQuadraticABA(opt: {
  N: number;
  f: number;
  sk: Uint8Array;
  root_block_cid: IPFSAddress<DBBlock>;
  node_id: NodeID;
  epoch: number;
  session_id: string;
  input: boolean;
  datasource_options: DataSourceOptions;
  dht_helper: IDHTHelper<SubProtocols>;
  cb: (node_id: NodeID, val: boolean) => void;
}) {
  const {
    cb,
    N,
    f,
    root_block_cid,
    sk,
    datasource_options,
    node_id,
    epoch,
    session_id,
    input,
    dht_helper,
  } = opt;

  let input_val: ABABooleanValue = input ? ABAValue.true : ABAValue.false;

  const ee = new EventEmitter<IABAEvents>();

  ee.addListener(
    'broadcast',
    async function (manager: EntityManager, msg: ABAMessage) {
      const encoded_msg = await encode(msg);
      const signature = await sign(sk, encoded_msg);
      dht_helper.broadcast({
        subProtocol: msg.stage,
        msg: encoded_msg,
        signature,
      });

      if (msg.stage === ABAProtocolStage.ABA_PREVOTE) {
        await on_receive_prevote(manager, msg, signature);
      } else if (msg.stage === ABAProtocolStage.ABA_VOTE) {
        await on_receive_vote(manager, msg, signature);
      } else if (msg.stage === ABAProtocolStage.ABA_FINALVOTE) {
        await on_receive_final_vote(manager, msg, signature);
      } else if (msg.stage === ABAProtocolStage.ABA_MAINVOTE) {
        await on_receive_main_vote(manager, msg, signature);
      }
    },
  );

  /**
   * 当收到 n-f 相同值的票时广播vote
   *
   * 如果收到f+1个相同的值，证明至少有一个诚实节点广播了这个值。
   */
  let prevote_threshold1_reached = false;
  let prevote_threshold2_reached = false;
  async function on_receive_prevote(
    manager: EntityManager,
    msg: ABAPreVoteMessage,
    signature: Signature<ABAPreVoteMessage>,
  ) {
    const { val, round, sender, epoch, session_id } = msg;
    if (
      await aba_store.has_prevote(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
        sender,
        val,
      )
    )
      return;
    await aba_store.set_prevote(manager, msg, signature);
    const new_count = await aba_store.get_prevote_count(
      manager,
      root_block_cid,
      epoch,
      session_id,
      round,
      val,
    );
    if (new_count >= f + 1 && prevote_threshold1_reached && input_val != val) {
      prevote_threshold1_reached = true;
      ee.emit('broadcast', manager, {
        stage: ABAProtocolStage.ABA_PREVOTE,
        root_block_cid,
        epoch,
        sender,
        session_id,
        round,
        val,
      });
    }
    if (new_count === N - f && prevote_threshold2_reached) {
      prevote_threshold2_reached = true;
      ee.emit('broadcast', manager, {
        stage: ABAProtocolStage.ABA_VOTE,
        root_block_cid,
        epoch,
        sender,
        session_id,
        round,
        val,
      });
    }
  }

  /**
   * 收到的v如果来自诚实的节点，它至少被n-f个节点认可
   *
   * 如果bset中不存在v，放入缓存
   *
   * 当收到n-f票(不一定值相同)时广播 main vote
   *    如果n-f票中有不同的值 广播 any，(意味着在上一阶段至少有一个诚实的节点发送的值与其他诚实节点不同)
   *    否则 广播 v，忠诚节点不可能广播非v
   */
  let vote_threshold_called = false;
  async function on_receive_vote(
    manager: EntityManager,
    msg: ABAVoteMessage,
    signature: Signature<ABAVoteMessage>,
  ) {
    const { epoch, session_id, round, sender, val } = msg;
    if (
      await aba_store.has_vote(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
        sender,
      )
    )
      return;
    await aba_store.set_vote(manager, msg, signature);
    if (
      (await aba_store.get_vote_size(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
      )) >=
        N - f &&
      !vote_threshold_called
    ) {
      vote_threshold_called = true;
      const [n_true, n_false] = await Promise.all([
        aba_store.get_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.true,
        ),
        aba_store.get_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.false,
        ),
      ]);
      ee.emit('broadcast', manager, {
        stage: ABAProtocolStage.ABA_MAINVOTE,
        epoch,
        root_block_cid,
        session_id,
        round,
        sender,
        val: n_true && n_false ? ABAValue.any : val,
      });
    }
  }

  let mainvote_threshold_reached = false;
  async function on_receive_main_vote(
    manager: EntityManager,
    msg: ABAMainVoteMessage,
    signature: Signature<ABAMainVoteMessage>,
  ) {
    const { val, round, epoch, sender } = msg;
    if (
      await aba_store.has_main_vote(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
        node_id,
      )
    )
      return;
    await aba_store.set_main_vote(manager, msg, signature);

    if (
      (await aba_store.get_main_vote_size(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
      )) >=
        N - f &&
      !mainvote_threshold_reached
    ) {
      mainvote_threshold_reached = true;
      const [n_true, n_false, n_any] = await Promise.all([
        aba_store.get_main_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.true,
        ),
        aba_store.get_main_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.false,
        ),
        aba_store.get_main_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.any,
        ),
      ]);
      const new_val = n_any === 0 && (!n_true || !n_false) ? val : ABAValue.any;
      ee.emit('broadcast', manager, {
        stage: ABAProtocolStage.ABA_FINALVOTE,
        epoch,
        root_block_cid,
        session_id,
        round,
        sender,
        val: new_val,
      });
    }
  }

  let finalvote_threshold_reached = false;
  async function on_receive_final_vote(
    manager: EntityManager,
    msg: ABAFinalVoteMessage,
    signature: Signature<ABAFinalVoteMessage>,
  ) {
    const { epoch, session_id, round, sender, val } = msg;
    if (
      await aba_store.has_final_vote(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
        sender,
      )
    )
      return;
    await aba_store.set_final_vote(manager, msg, signature);
    if (
      (await aba_store.get_final_vote_size(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
      )) ===
        N - f &&
      !finalvote_threshold_reached
    ) {
      finalvote_threshold_reached = true;
      let next_round_v: boolean;
      const [n_true, n_false, n_any] = await Promise.all([
        aba_store.get_final_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.true,
        ),
        aba_store.get_final_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.false,
        ),
        aba_store.get_final_vote_count(
          manager,
          root_block_cid,
          epoch,
          session_id,
          round,
          ABAValue.any,
        ),
      ]);
      if ((n_true && n_false) || (!n_true && !n_false && n_any)) {
        next_round_v = !!(Math.random() > 0.5);
      } else if (!n_any) {
        await aba_store.set_current_info(manager, {
          round,
          root_block_cid,
          epoch,
          stage: ABAProtocolStage.ABA_DECIDED,
          val: val === ABAValue.true ? ABAValue.true : ABAValue.false,
          session_id,
        });
        cb(session_id, val === ABAValue.true);
        return;
      } else {
        next_round_v = n_false ? false : true;
      }

      input_val = next_round_v ? ABAValue.true : ABAValue.false;
      ee.emit('broadcast', manager, {
        stage: ABAProtocolStage.ABA_PREVOTE,
        epoch,
        root_block_cid,
        sender,
        session_id,
        round: round + 1,
        val: next_round_v ? ABAValue.true : ABAValue.false,
      });
    }
  }

  const dht_on_message: IDHTBroadcastHandler<SubProtocols> = async function (
    sender,
    { msg, signature },
  ) {
    sub_transation(datasource_options, async (manager) => {
      const aba_msg = await get_aba_data_from_raw(
        manager,
        epoch,
        sender,
        msg,
        signature,
      );
      const { round, stage, val } = aba_msg;

      const current_info = await aba_store.get_current_info(
        manager,
        root_block_cid,
        epoch,
        session_id,
      );
      // 对应的RBC未完成
      if (!current_info) {
        return;
      }
      // 如果发送者领先
      if (
        current_info.round < round ||
        (current_info.round === round &&
          stage_compare(current_info.stage, stage) < 0)
      ) {
        // 如果领先一轮以内，放入缓存，否则忽略
        if (round <= current_info.round + 1) {
          aba_store.add_cache(manager, {
            ...aba_msg,
            signature,
          });
        } else {
          console.log('ignore');
        }
        return;
        // 如果发送者落后，发送当时的stage发送的消息(如果最近x分钟没有发送过同样的消息)
      } else if (
        current_info.round > round ||
        (current_info.round === round &&
          stage_compare(current_info.stage, stage) > 0)
      ) {
        let old_vals: ABAValue[] = [];
        if (stage === ABAProtocolStage.ABA_PREVOTE) {
          old_vals = await aba_store.get_prevote(
            manager,
            root_block_cid,
            epoch,
            session_id,
            round,
            node_id,
          );
        } else if (stage === ABAProtocolStage.ABA_VOTE) {
          old_vals = [
            await aba_store.get_vote(
              manager,
              root_block_cid,
              epoch,
              session_id,
              round,
              node_id,
            ),
          ];
        } else if (stage === ABAProtocolStage.ABA_MAINVOTE) {
          old_vals = [
            await aba_store.get_main_vote(
              manager,
              root_block_cid,
              epoch,
              session_id,
              round,
              node_id,
            ),
          ];
        } else if (stage === ABAProtocolStage.ABA_FINALVOTE) {
          old_vals = [
            await aba_store.get_final_vote(
              manager,
              root_block_cid,
              epoch,
              session_id,
              round,
              node_id,
            ),
          ];
        }
        for (const old_val of old_vals) {
          // TODO 如果最近x分钟没有发送过同样的消息才发送
          const encoded_msg = await encode({
            epoch,
            session_id,
            stage,
            round,
            val: old_val,
          });
          dht_helper.send(sender, {
            subProtocol: stage,
            msg: encoded_msg,
            signature: await sign(sk, encoded_msg),
          });
        }
        return;
      }

      const cached_msgs = await aba_store.get_cache(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
        stage,
      );
      if (stage === ABAProtocolStage.ABA_FINALVOTE) {
        on_receive_final_vote(manager, aba_msg, signature);
        cached_msgs.forEach((msg) => {
          on_receive_final_vote(
            manager,
            {
              val: msg.val,
              session_id: msg.session_id,
              epoch: msg.epoch,
              round: msg.round,
              root_block_cid: aba_msg.root_block_cid,
              sender: msg.sender,
              stage: stage,
            },
            msg.signature,
          );
        });
      } else if (stage === ABAProtocolStage.ABA_PREVOTE) {
        on_receive_prevote(manager, aba_msg, signature);
        cached_msgs.forEach((cache) => {
          on_receive_prevote(
            manager,
            {
              root_block_cid: aba_msg.root_block_cid,
              epoch: cache.epoch,
              sender: cache.sender,
              session_id: cache.session_id,
              val: cache.val as ABABooleanValue,
              round: cache.round,
              stage: ABAProtocolStage.ABA_PREVOTE,
            },
            cache.signature,
          );
        });
      } else if (stage === ABAProtocolStage.ABA_VOTE) {
        on_receive_vote(manager, aba_msg, signature);
        cached_msgs.forEach((cache) => {
          on_receive_vote(
            manager,
            {
              root_block_cid: aba_msg.root_block_cid,
              epoch: cache.epoch,
              sender: cache.sender,
              session_id: cache.session_id,
              val: cache.val as ABABooleanValue,
              round: cache.round,
              stage: ABAProtocolStage.ABA_VOTE,
            },
            cache.signature,
          );
        });
      } else if (stage === ABAProtocolStage.ABA_MAINVOTE) {
        on_receive_main_vote(manager, aba_msg, signature);
        cached_msgs.forEach((cache) => {
          on_receive_main_vote(
            manager,
            {
              root_block_cid: aba_msg.root_block_cid,
              epoch: cache.epoch,
              sender: cache.sender,
              session_id: cache.session_id,
              val: cache.val as ABABooleanValue,
              round: cache.round,
              stage: ABAProtocolStage.ABA_MAINVOTE,
            },
            cache.signature,
          );
        });
      }
      await aba_store.remove_cache(
        manager,
        root_block_cid,
        epoch,
        session_id,
        round,
        stage,
      );
    });
  };

  dht_helper.addListener(ABAProtocolStage.ABA_VOTE, dht_on_message);
  dht_helper.addListener(ABAProtocolStage.ABA_PREVOTE, dht_on_message);
  dht_helper.addListener(ABAProtocolStage.ABA_MAINVOTE, dht_on_message);
  dht_helper.addListener(ABAProtocolStage.ABA_FINALVOTE, dht_on_message);

  sub_transation(datasource_options, async (manager) => {
    const current_info = await aba_store.get_current_info(
      manager,
      root_block_cid,
      epoch,
      session_id,
    );

    ee.emit(
      'broadcast',
      manager,
      current_info
        ? ({
            epoch,
            root_block_cid,
            session_id,
            stage: current_info.stage,
            round: current_info.round,
            sender: node_id,
            val: current_info.val as ABABooleanValue,
          } as ABAMessage)
        : {
            epoch,
            session_id,
            stage: ABAProtocolStage.ABA_PREVOTE,
            root_block_cid,
            sender: node_id,
            round: 0,
            val: input_val,
          },
    );
  });
}

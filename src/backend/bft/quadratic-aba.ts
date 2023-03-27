import { EventEmitter } from 'tsee';
import { PeerId } from '@libp2p/interface-peer-id';
import { ABAValue, Context, IDBABA, IP2PBroadcastProtocol, IP2PBroadcastSubProtocolMessageWrapper, NodeID } from '../types';
import {
  ABAValue as Value,
  ABABooleanValue as BooleanValue,
  IABAEvents,
} from '../types';
import { decode, encode, sign } from '../utils';

const ProtocolId = 'ABA';

enum ABAMessageType {
  PREVOTE,
  VOTE,
  MAINVOTE,
  FINALVOTE,
}

type BasicMessage = {
  session_id: string;
  epoch: number;
  round: number;
};
type PreVoteMessage = BasicMessage & {
  type: ABAMessageType.PREVOTE;
  val: BooleanValue;
};

type VoteMessage = BasicMessage & {
  type: ABAMessageType.VOTE;
  val: BooleanValue;
};

type MainVoteMessage = BasicMessage & {
  type: ABAMessageType.MAINVOTE;
  val: Value;
};

type FinalVoteMessage = BasicMessage & {
  type: ABAMessageType.FINALVOTE;
  val: Value;
};

type ABAMessage =
  | PreVoteMessage
  | VoteMessage
  | MainVoteMessage
  | FinalVoteMessage;

type ABAMessageWithSignature = {
  encoded_msg: Uint8Array; // encode(ABAMessage)
  signature: Uint8Array;
};

async function broadcast(
  p2pbroadcast_protocol: IP2PBroadcastProtocol,
  msg: ABAMessage,
  sk: Uint8Array,
) {
  const encoded_msg = await encode(msg);
  p2pbroadcast_protocol.broadcast<{
    msg: ABAMessageWithSignature;
  }>({
    subProtocol: ProtocolId,
    msg: {
      encoded_msg,
      signature: await sign(sk, encoded_msg),
    },
  });
}

export default function createQuadraticABA(opt: {
  N: number,
  f: number,
  sk: Uint8Array,
  node_id: NodeID,
  epoch: number,
  session_id: string,
  input: boolean,
  store: IDBABA,
  p2pbroadcast_protocol: IP2PBroadcastProtocol,
}) {
  const { store, N, f, sk, node_id, epoch, session_id, input, p2pbroadcast_protocol } = opt;
  const ee = new EventEmitter<IABAEvents>();
  let round = 0;

  /**
   * 当收到 n-f 相同值的票时广播vote
   *
   * 如果收到f+1个相同的值，证明至少有一个诚实节点广播了这个值。
   */
  ee.on('receivePrevote', async (sender, store, r, v) => {
    if (await store.has_prevote(epoch, session_id, r, sender, v)) return;
    await store.set_prevote(epoch, session_id, r, sender, v);
    const new_count = await store.get_prevote_count(epoch, session_id, r, v);
    if (new_count === f + 1) {
      broadcast(
        p2pbroadcast_protocol,
        {
          type: ABAMessageType.PREVOTE,
          epoch,
          session_id,
          round: r,
          val: v,
        },
        sk,
      );
    }
    if (new_count === N - f) {
      broadcast(
        p2pbroadcast_protocol,
        {
          type: ABAMessageType.VOTE,
          epoch,
          session_id,
          round: r,
          val: v,
        },
        sk,
      );
      ee.emit('receiveVote', node_id, store, round, v);
    }
  });

  /**
   * 收到的v如果来自诚实的节点，它至少被n-f个节点认可
   *
   * 如果bset中不存在v，放入缓存
   *
   * 当收到n-f票(不一定值相同)时广播 main vote
   *    如果n-f票中有不同的值 广播 any，(意味着在上一阶段至少有一个诚实的节点发送的值与其他诚实节点不同)
   *    否则 广播 v，忠诚节点不可能广播非v
   */
  ee.on('receiveVote', async (sender, store, r, v) => {
    if (await store.has_vote(epoch, session_id, r, sender)) return;
    await store.set_vote(epoch, session_id, r, sender, v);
    if (await store.get_prevote_count(epoch, session_id, r, v) < N -f) {
      // TODO cache
      return;
    }
    if (await store.get_vote_size(epoch, session_id, r) === N - f) {
      const [n_true, n_false] = await Promise.all([
        store.get_vote_count(epoch, session_id, r, Value.true),
        store.get_vote_count(epoch, session_id, r,Value.false),
      ])
      const val = n_true && n_false ? Value.any : v;
      broadcast(
        p2pbroadcast_protocol,
        {
          type: ABAMessageType.MAINVOTE,
          epoch,
          session_id,
          round,
          val,
        },
        sk,
      );
      ee.emit('receiveMainVote', node_id, store, round, val);
    }
  });

  ee.on('receiveMainVote', async (sender, store, r, v) => {
    if (await store.has_main_vote(epoch, session_id, r,sender)) return;
    store.set_main_vote(epoch, session_id, r,sender, v);

    if (v !== Value.any) {
      if (
        (await store.get_vote_count(epoch, session_id, r, v as BooleanValue)) <
          N - f || // 第一阶段没有收到多数票
        (await store.get_vote_count(epoch, session_id, r, v as BooleanValue)) <=
          f // 第二阶段没有收到多数票
      ) {
        // TODO 放入缓存
        return;
      }
    } else {
      const [n_true, n_false] = await Promise.all([
        store.get_prevote_count(epoch, session_id, r, ABAValue.true),
        store.get_prevote_count(epoch, session_id, r,ABAValue.false),
      ]);
      // if () {
      //   // 如果第一阶段改变了投票
      //   // TODO 放入缓存
      //   return;
      // }
    }

    if ((await store.get_main_vote_size(epoch, session_id, r)) === N - f) {
      const [n_true, n_false, n_any] = await Promise.all([
        store.get_main_vote_count(epoch, session_id, r,ABAValue.true),
        store.get_main_vote_count(epoch, session_id, r,ABAValue.false),
        store.get_main_vote_count(epoch, session_id, r,ABAValue.any),
      ]);
      const val = n_any === 0 && (!n_true || !n_false) ? v : Value.any;
      broadcast(
        p2pbroadcast_protocol,
        {
          type: ABAMessageType.FINALVOTE,
          epoch,
          session_id,
          round,
          val,
        },
        sk,
      );
      ee.emit('receiveFinal', node_id, store, round, val);
    }
  });

  ee.on('receiveFinal', async (sender, store, r, v) => {
    if (v !== Value.any) {
      if (
        await store.get_prevote_count(epoch, session_id, r,v) < N -f || // 第一阶段没有收到多数票
        await store.get_vote_count(epoch, session_id, r,v) < N-f // 第二阶段没有收到多数票
      ) {
        // TODO 放入缓存
        return;
      }
    } else {
      // if () {
      //   // 如果第一阶段改变了投票
      //   // TODO 放入缓存
      //   return;
      // }
    }
    if (await store.has_final_vote(epoch, session_id, r,sender)) return;
    await store.set_final_vote(epoch, session_id, r,sender, v);
    if ((await store.get_final_vote_size(epoch, session_id, r,)) === N - f) {
      let next_round_v: boolean;
      const [n_true, n_false, n_any] = await Promise.all([
        store.get_final_vote_count(epoch, session_id, r,ABAValue.true),
        store.get_final_vote_count(epoch, session_id, r,ABAValue.false),
        store.get_final_vote_count(epoch, session_id, r,ABAValue.any),
      ]);
      if (
        (n_true && n_false) ||
        (!n_true && !n_false && n_any)
      ) {
        next_round_v = !!(Math.random() > 0.5);
      } else if (!n_any) {
        ee.emit('resolveOne', session_id, v);
        return;
      } else {
        next_round_v = n_false ? false : true;
      }

      round++;
      broadcast(
        p2pbroadcast_protocol,
        {
          type: ABAMessageType.PREVOTE,
          epoch,
          session_id,
          round,
          val: next_round_v ? Value.true : Value.false,
        },
        sk,
      );
      ee.emit(
        'receivePrevote',
        node_id,
        store,
        round,
        next_round_v ? Value.true : Value.false,
      );
    }
  });

  broadcast(
    p2pbroadcast_protocol,
    {
      type: ABAMessageType.PREVOTE,
      epoch,
      session_id,
      round,
      val: input ? Value.true : Value.false,
    },
    sk,
  );
  ee.emit('receivePrevote', node_id, store, round, input ? Value.true : Value.false);

  async function onMessage(senderPeer: PeerId, raw: IP2PBroadcastSubProtocolMessageWrapper<{msg: ABAMessageWithSignature}>) {
    const { encoded_msg, signature } = raw.msg;
    const msg = await decode<ABAMessage>(encoded_msg);
    if (round < msg.round) {
      // TODO
    }
    if (msg.type === ABAMessageType.FINALVOTE) {
      ee.emit('receiveFinal', senderPeer.toString(), store, msg.round, msg.val);
    } else if (msg.type === ABAMessageType.PREVOTE) {
      ee.emit('receivePrevote', senderPeer.toString(), store, msg.round, msg.val);
    } else if (msg.type === ABAMessageType.VOTE) {
      ee.emit('receiveVote', senderPeer.toString(), store, msg.round, msg.val);
    } else if (msg.type === ABAMessageType.MAINVOTE) {
      ee.emit('receiveMainVote', senderPeer.toString(), store, msg.round, msg.val);
    }
  }

  p2pbroadcast_protocol.addListener(ProtocolId,onMessage)
  return ee;
}
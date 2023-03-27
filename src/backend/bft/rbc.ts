import { CID } from 'multiformats/cid';
import { PeerId } from '@libp2p/interface-peer-id';
import { EventEmitter } from 'tsee';
import {
  ECHOMessage,
  IContentDeliverer,
  IDBRBC,
  IP2PBroadcastProtocol,
  IP2PBroadcastSubProtocolMessageWrapper,
  IRBCEvents as IRBCEvents,
  NodeID,
  RBCMessage,
  RBCMessageType,
  READYMessage,
  VALMessage,
} from '../types';
import { decode, encode, get_cid, hash, sign, verify } from '../utils';
import createErasureCoding from './erasure-coding';
import { Context } from '../types';
import {
  createMerkleTree,
  getMerkleBranch,
  merkleVerify,
} from '../../../shared/utils/merkletree';
import assert from 'assert';

const ProtocolId = 'RBC';
type RBCMessageWithSignature = {
  encoded_msg: Uint8Array; // encode(RBCMessage)
  signature: Uint8Array;
};

enum RBCEvent {
  receiveEcho = 'receiveEcho',
  receiveVal = 'receiveVal',
  receiveReady = 'receiveReady',
}

/**
 * alias: AVID/ECRBC/PRBC
 *
 * 每个节点在每个Epoch开始时创建1个rbc实例，在Epoch结束时销毁
 *
 * 每个rbc实例有两个作用：
 * 1）广播自己的消息，获得至少n-f个对它的预确认
 * 2）接收和转发其他节点的rbc消息，分别获得至少n-f个对某节点消息的预确认
 *
 * 每个rbc实例的resolve条件是获得至少n-f个节点的消息并且其中每个消息都获得了至少n-f个预确认。
 * 在resolve之后，实例仍然运行（接收并转发其他节点的消息），直到Epoch结束。
 *
 *
 * RBC主要步骤：
 * (1)
 * 把消息 m 分成 N 份，任意 K 份可以恢复 m
 * 用这 N 份片段的哈希组成完全二叉树 MerkleTree
 *
 * 分片使消息msg_i难以被针对（对特定内容进行干扰，影响传播成功率等等），其他节点在收到n-f个分片前无法得知消息内容。
 * 同时分片大大提高了去中心化网络的利用率，降低了发送者的带宽消耗。
 *
 * (2)
 * 向其他节点广播 VAL 消息
 * 当收到VAL
 *  验证 MerkleTree 合法性
 *  广播 ECHO 消息
 *
 * (3)
 * 当收到 ECHO
 *  验证 MerkleTree 合法性
 *  如果当前 MerkleTree root 收到超过 N - f 个ECHO
 *    还原 msg 并 发布到ipfs
 *    广播 READY(cid,sourceProvider,sign)
 *
 * (4)
 * 当收到 READY
 *  签名校验
 *  如果收到该root 的超过f+1个READY，进行签名并转发(至少有一个诚实节点主动发出了READY)
 *  如果收到该root 的超过2f+1个有效READY
 *    ipfs get(cid)，生成这个阶段的证明
 *    resolveOne: 输出 node_id 和 data
 *    如果resolveOne的次数超过n-f, resolveAll: 输出 m 和 证明
 */
export default function createProvableReliableBroadcast(opt: {
  node_id: NodeID;
  node_ids: NodeID[];
  N: number;
  f: number;
  input: Uint8Array;
  node_id_to_index: { [id: string]: number };
  PKs: { [node_id: NodeID]: Uint8Array };
  sk: Uint8Array;
  store: IDBRBC;
  p2pbroadcast_protocol: IP2PBroadcastProtocol;
  epoch: number;
  content_deliverer: IContentDeliverer;
  ee: EventEmitter<IRBCEvents>;
}) {
  const {
    node_id,
    store,
    node_ids,
    N,
    f,
    input,
    epoch,
    node_id_to_index,
    PKs,
    sk,
    p2pbroadcast_protocol,
    content_deliverer,
    ee,
  } = opt;
  const node_ids_set = new Set<NodeID>(node_ids);
  assert(N >= 3 * f + 1);
  assert(f >= 0);

  const EchoThreshold = N - f; // Wait for this many ECHO to send READY. (# noqa: E221)
  const ReadyThreshold = f + 1; // Wait for this many READY to amplify READY. (# noqa: E221)
  const OutputThreshold = N - f; // Wait for this many READY to output
  // NOTE: The above thresholds  are chosen to minimize the size
  // of the erasure coding stripes, i.e. to maximize K.
  // The following alternative thresholds are more canonical
  // (e.g., in Bracha '86) and require larger stripes, but must wait
  // for fewer nodes to respond
  //   EchoThreshold = ceil((N + f + 1.)/2)
  //   K = EchoThreshold - f

  const ec = createErasureCoding(N, f);

  async function broadcast(
    p2pbroadcast_protocol: IP2PBroadcastProtocol,
    sk: Uint8Array,
    msg: ECHOMessage | READYMessage,
  ) {
    const encoded_msg = await encode(msg);
    p2pbroadcast_protocol.broadcast<{ msg: RBCMessageWithSignature }>({
      subProtocol: ProtocolId,
      msg: {
        encoded_msg,
        signature: await sign(sk, encoded_msg),
      },
    });
  }

  async function sendVal(
    p2pbroadcast_protocol: IP2PBroadcastProtocol,
    sk: Uint8Array,
    target: NodeID,
    msg: VALMessage,
  ) {
    const encoded_msg = await encode(msg);
    p2pbroadcast_protocol.send<{ msg: RBCMessageWithSignature }>(target, {
      subProtocol: ProtocolId,
      msg: {
        encoded_msg,
        signature: await sign(sk, encoded_msg),
      },
    });
  }

  function verifyRBCMessage(sender: NodeID, data: RBCMessage) {
    assert(
      data &&
        (data.type === RBCMessageType.ECHO ||
          data.type === RBCMessageType.VAL ||
          data.type === RBCMessageType.READY),
    );
    if (data.type === RBCMessageType.VAL) {
      assert(
        data.piece instanceof Uint8Array &&
          typeof data.roothash === 'string' &&
          data.branch instanceof Array &&
          data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
          merkleVerify(
            data.piece,
            data.roothash,
            data.branch,
            node_id_to_index[node_id],
          ),
      );
    } else if (data.type === RBCMessageType.ECHO) {
      assert(
        node_ids_set.has(data.pieceOwner) &&
          node_ids_set.has(data.sourceProvider) &&
          data.piece instanceof Uint8Array &&
          typeof data.roothash === 'string' &&
          data.branch instanceof Array &&
          data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
          merkleVerify(
            data.piece,
            data.roothash,
            data.branch,
            node_id_to_index[data.pieceOwner],
          ),
      );
    } else if (data.type === RBCMessageType.READY) {
      assert(
        typeof data.sourceProviderMsgCID === 'string' &&
          node_ids_set.has(data.sourceProvider),
      );
    }
  }

  ee.addListener('receiveVal', async (sender, data) => {
    if (await store.get_val(epoch, sender)) return;
    await store.set_val(epoch, sender, Buffer.from(await encode(data)));

    const msg: ECHOMessage = {
      type: RBCMessageType.ECHO,
      epoch,
      sourceProvider: sender,
      pieceOwner: node_id,
      branch: data.branch,
      roothash: data.roothash,
      piece: data.piece,
    };
    ee.emit(RBCEvent.receiveEcho, node_id, msg);
    broadcast(p2pbroadcast_protocol, sk, msg);
  });

  ee.addListener(RBCEvent.receiveEcho, async (sender, data) => {
    const { sourceProvider, pieceOwner, piece, roothash } = data;

    if (pieceOwner !== sender) {
      debugger;
      return;
    }

    if (await store.has_echo(epoch, pieceOwner, sourceProvider)) {
      debugger;
      return;
    }
    await store.set_echo(
      epoch,
      pieceOwner,
      sourceProvider,
      roothash,
      Buffer.from(piece),
    );

    if (
      (await store.get_echo_size(epoch, sourceProvider, roothash)) >=
      EchoThreshold
    ) {
      if (await store.has_ready(epoch, node_id, sourceProvider)) return;

      const sourceProviderMsg = ec.decode(
        (await store.get_echo(epoch, sourceProvider, roothash)).map((i) =>
          Uint8Array.from(i),
        ),
      );
      const sourceProviderMsgCID = await content_deliverer.provide(
        sourceProviderMsg,
      );
      const msg: READYMessage = {
        type: RBCMessageType.READY,
        epoch,
        sourceProviderMsgCID,
        sourceProvider,
      };
      ee.emit(
        RBCEvent.receiveReady,
        node_id,
        msg,
        await sign(sk, await encode(msg)),
      );
      broadcast(p2pbroadcast_protocol, sk, msg);
    }
  });

  let resolved = false;
  ee.addListener(RBCEvent.receiveReady, async (sender, data, signature) => {
    const { sourceProvider, sourceProviderMsgCID } = data;
    if (await store.has_ready(epoch, sender, sourceProvider)) return;
    await store.set_ready(
      epoch,
      sender,
      sourceProvider,
      sourceProviderMsgCID,
      Buffer.from(signature),
    );

    const nVote = await store.get_ready_size(
      epoch,
      sourceProvider,
      sourceProviderMsgCID,
    );

    // Amplify ready messages
    if (nVote >= ReadyThreshold) {
      broadcast(p2pbroadcast_protocol, sk, data);
    }

    if (nVote >= OutputThreshold) {
      if (resolved) return;
      resolved = true;

      const provider_data = await content_deliverer.get<Uint8Array>(
        sourceProviderMsgCID,
      );
      
      ee.emit('resolveOne', sourceProvider, {
        data: provider_data,
        cid: sourceProviderMsgCID,
        signature,
      });
    }
  });

  async function onMessage(
    senderPeer: PeerId,
    raw: IP2PBroadcastSubProtocolMessageWrapper<{
      msg: RBCMessageWithSignature;
    }>,
  ) {
    const sender = senderPeer.toString();
    if (!raw ||  !raw.msg || !raw.msg.encoded_msg || !raw.msg.signature) {
      console.warn('unknown msg', raw);
      debugger;
      return;
    }
    let data:RBCMessage;
    try {
      data = await decode<RBCMessage>(raw.msg.encoded_msg);
    } catch (e) {
      console.warn('unable to decode', raw);
      debugger;
    }

    if (
      !(await verify(
        PKs[senderPeer.toString()],
        raw.msg.encoded_msg,
        raw.msg.signature,
      ))
    ) {
      debugger;
      return;
    }

    try {
      verifyRBCMessage(sender, data);
    } catch (e) {
      console.log(e);
      debugger;
    }

    if (data.epoch !== epoch) {
      debugger;
      return;
      // TODO
    }

    if (data.type === RBCMessageType.VAL) {
      ee.emit(RBCEvent.receiveVal, sender, data);
    } else if (data.type === RBCMessageType.ECHO) {
      ee.emit(RBCEvent.receiveEcho, sender, data);
    } else if (data.type === RBCMessageType.READY) {
      ee.emit(RBCEvent.receiveReady, sender, data, raw.msg.signature);
    }
  }

  async function start() {
    const pieces = ec.encode(input);
    const mtree = createMerkleTree(pieces);
    const roothash = mtree[1];

    for (const id of node_ids) {
      const branch = getMerkleBranch(node_id_to_index[id], mtree);
      const msg: VALMessage = {
        type: RBCMessageType.VAL,
        epoch,
        branch,
        roothash,
        piece: pieces[node_id_to_index[id]],
      };
      if (id === node_id) {
        ee.emit(RBCEvent.receiveVal, node_id, msg);
        continue;
      }
      sendVal(p2pbroadcast_protocol, sk, id, msg);
    }
    p2pbroadcast_protocol.addListener(ProtocolId, onMessage);
  }
  start();
}

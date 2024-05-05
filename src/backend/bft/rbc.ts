import { CID } from 'multiformats/cid';
import { PeerId } from '@libp2p/interface-peer-id';
import { EventEmitter } from 'tsee';
import {
  RBCEchoMessage,
  NodeID,
  RBCMessage,
  RBCReadyMessage,
  RBCValMessage,
  IDHTHelper,
  RBCProtocols,
  RBCProtocolStage,
  RBCStage,
  IPFSAddress,
  IDHTBroadcastHandler,
  Action,
  DBBlock,
  Signature,
  Encoded,
} from '../types';
import { decode, encode, get_cid, hash, sign, verify } from '../utils';
import createErasureCoding from './erasure-coding';
import { Context } from '../types';
import {
  createMerkleTree as create_merkle_tree,
  getMerkleBranch as get_merkle_branch,
  merkleVerify as merkle_verify,
} from '../../../shared/utils/merkletree';
import assert from 'assert';
import * as rbc_store from '../database/rbc';
import * as peer_store from '../database/peer';
import * as block_store from '../database/block';

import { Mutex } from 'async-mutex';
import { DataSource, DataSourceOptions, EntityManager } from 'typeorm';
import { sub_transation } from '../database/utils';

const ProtocolId = 'RBC';
type RBCMessageWithSignature = {
  encoded_msg: Uint8Array; // encode(RBCMessage)
  signature: Uint8Array;
};

/**
 * DHT Reliable Broadcast
 *
 * 类似的协议: AVID/ECRBC/PRBC
 * 
 * 相关论文
 * https://eprint.iacr.org/2022/775.pdf
 *
 * 每个节点在每个Epoch开始时创建1个rbc实例，在Epoch结束时销毁
 *
 * 每个rbc实例有以下作用：
 * 1）广播自己的消息，获得至少n-f个对它的预确认
 * 2）接收和转发其他节点的rbc消息，分别获得至少n-f个对某节点消息的预确认
 * 3) 基于DHT，为其他节点恢复数据
 *
 * 每个rbc实例的resolve条件是获得至少n-f个节点的消息并且其中每个消息都获得了至少n-f个预确认。
 * 在resolve之后，实例仍然运行（接收并转发其他节点的消息），直到Epoch结束。
 *
 * RBC主要步骤：
 * (1)
 * 把消息 m 分成 N 份，任意 K 份可以恢复 m
 * 用这 N 份片段的哈希组成完全二叉树 MerkleTree
 *
 * 分片使消息msg_i难以被针对（对特定内容进行干扰，影响传播成功率等等），其他节点在收到n-f个分片前无法得知消息内容。
 * 同时分片大大提高了去中心化网络的利用率，降低了发送者的带宽消耗。
 * (TODO)使用对称加密对每个分片加密，密码分散在各个分片中。
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
 *    还原 msg 并 发布到DHT
 *    广播 READY(cid,sourceProvider,sign)
 * 补充：此cid每个节点都有义务保持其可用性，当发布到DHT时在本地数据库中记录该cid，并定期在数据库中随机选择一个cid，保持其活跃（6小时内可下载）。
 * 一段时间t内随机维护的cid数量应大于一段时间发布的cid数量，使落后的节点大概率能找到其provider并且能赶上进度
 *
 * (4)
 * 当收到 READY
 *  签名校验
 *  如果收到该root 的超过f+1个READY，进行签名并转发(至少有一个诚实节点主动发出了READY)
 *  如果收到该root 的超过2f+1个有效READY
 *    DHT get(cid)，生成这个阶段的证明
 *    resolve: 输出 node_id 和 data
 *
 *    如果resolveOne的次数超过n-f, resolveAll: 输出 m 和 证明。
 */
export default async function createReliableBroadcast(opt: {
  node_id: NodeID;
  N: number;
  mutex: Mutex;
  f: number;
  epoch: number;
  input: Action[];
  sk: Uint8Array;
  root_block_cid: IPFSAddress<DBBlock>;
  dht_helper: IDHTHelper<RBCProtocols>;
  datasource_options: DataSourceOptions;
  resolveOne: (node_id: NodeID) => void;
}) {
  const {
    datasource_options,
    node_id,
    N,
    f,
    mutex,
    input,
    epoch,
    root_block_cid,
    sk,
    resolveOne,
    dht_helper,
  } = opt;
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

  async function get_rbc_data_from_raw(
    manager: EntityManager,
    sender: NodeID,
    encoded_msg: Encoded<RBCMessage>,
    signature: Signature<RBCMessage>,
  ) {
    assert(typeof sender === 'string');
    assert(encoded_msg && signature, 'unknown msg');
    let data: RBCMessage;
    try {
      data = await decode<RBCMessage>(encoded_msg);
    } catch (e) {
      console.warn('decode failed', encoded_msg);
      throw new Error('unable to decode');
    }

    if (
      !(await verify(
        await peer_store.get_pubkey(manager, sender),
        encoded_msg,
        signature,
      ))
    ) {
      debugger;
      throw new Error('bad signature');
    }

    if (!data) {
      debugger;
      throw new Error('bad data');
    }

    return data;
  }

  async function broadcast(
    manager: EntityManager,
    dht_helper: IDHTHelper<RBCProtocols>,
    sk: Uint8Array,
    msg: RBCEchoMessage | RBCReadyMessage,
    subProtocol: RBCProtocols,
  ) {
    const encoded_msg = await encode(msg);
    const signature = await sign(sk, encoded_msg);
    dht_helper.broadcast({
      subProtocol,
      msg: encoded_msg,
      signature,
    });
    if (msg.stage === RBCProtocolStage.RBC_ECHO) {
      on_receive_echo(manager, node_id, msg, signature);
    } else if (msg.stage === RBCProtocolStage.RBC_READY) {
      on_receive_ready(manager, node_id, msg, signature);
    }
  }

  async function send_val(
    manager: EntityManager,
    dht_helper: IDHTHelper<RBCProtocols>,
    sk: Uint8Array,
    target: NodeID,
    msg: RBCValMessage,
  ) {
    const encoded_msg = await encode(msg);
    const signature = await sign(sk, encoded_msg);
    if (target === node_id) {
      on_receive_val(manager, msg, signature);
    } else {
      dht_helper.send(target, {
        subProtocol: RBCProtocolStage.RBC_VAL,
        msg: encoded_msg,
        signature,
      });
    }
  }

  async function on_receive_val(
    manager: EntityManager,
    data: RBCValMessage,
    signature: Signature<RBCValMessage>,
  ) {
    const { piece_provider: sender } = data;
    if (await rbc_store.has_val(manager, root_block_cid, epoch, sender)) return;
    await rbc_store.set_val(manager, data, signature);

    const msg: RBCEchoMessage = {
      sender,
      stage: RBCProtocolStage.RBC_ECHO,
      root_block_cid,
      epoch,
      piece_provider: sender,
      piece_receiver: node_id,
      branch: data.branch,
      roothash: data.roothash,
      piece: data.piece,
    };
    broadcast(manager, dht_helper, sk, msg, RBCProtocolStage.RBC_ECHO);
  }

  const echo_threshold_reached = new Map<NodeID, Set<string>>();
  async function on_receive_echo(
    manager: EntityManager,
    sender: NodeID,
    data: RBCEchoMessage,
    signature: Signature<RBCEchoMessage>,
  ) {
    const {
      piece_provider: source_provider,
      piece_receiver: pieceOwner,
      piece,
      roothash,
    } = data;

    if (pieceOwner !== sender) {
      debugger;
      return;
    }

    if (
      await rbc_store.has_echo(
        manager,
        root_block_cid,
        epoch,
        pieceOwner,
        source_provider,
      )
    ) {
      debugger;
      return;
    }
    await rbc_store.set_echo(manager, data, signature);

    if (
      (await rbc_store.get_echo_size(
        manager,
        root_block_cid,
        epoch,
        source_provider,
        roothash,
      )) >= EchoThreshold &&
      !echo_threshold_reached.get(source_provider)?.has(roothash)
    ) {
      if (!echo_threshold_reached.has(source_provider)) {
        echo_threshold_reached.set(source_provider, new Set([roothash]));
      } else {
        echo_threshold_reached.get(source_provider).add(roothash);
      }

      const source_provider_message = ec.decode(
        (
          await rbc_store.get_echoes(
            manager,
            root_block_cid,
            epoch,
            source_provider,
            roothash,
          )
        ).map((i) => Uint8Array.from(i)),
      );
      const source_provider_message_cid = await dht_helper.provide(
        source_provider_message,
      );
      const msg: RBCReadyMessage = {
        stage: RBCProtocolStage.RBC_READY,
        root_block_cid,
        sender,
        epoch,
        cid: source_provider_message_cid,
        provider: source_provider,
      };
      broadcast(manager, dht_helper, sk, msg, RBCProtocolStage.RBC_READY);
    }
  }

  const ready_threshold1_reached = new Map<NodeID, Set<string>>();
  const ready_threshold2_reached = new Map<NodeID, Set<string>>();
  async function on_receive_ready(
    manager: EntityManager,
    sender: NodeID,
    data: RBCReadyMessage,
    signature: Signature<RBCReadyMessage>,
  ) {
    const {
      provider: source_provider,
      cid: source_provider_message_cid,
    } = data;
    if (
      await rbc_store.has_ready(
        manager,
        root_block_cid,
        epoch,
        sender,
        source_provider,
      )
    )
      return;
    await rbc_store.set_ready(manager, data, signature);

    const nVote = await rbc_store.get_ready_size(
      manager,
      root_block_cid,
      epoch,
      source_provider,
      source_provider_message_cid,
    );

    // Amplify ready messages
    if (
      nVote >= ReadyThreshold &&
      !ready_threshold1_reached
        .get(source_provider)
        ?.has(source_provider_message_cid)
    ) {
      if (!ready_threshold1_reached.has(source_provider)) {
        ready_threshold1_reached.set(
          source_provider,
          new Set([source_provider_message_cid]),
        );
      } else {
        ready_threshold1_reached
          .get(source_provider)
          .add(source_provider_message_cid);
      }
      broadcast(manager, dht_helper, sk, data, RBCProtocolStage.RBC_READY);
    }

    if (
      nVote >= OutputThreshold &&
      !ready_threshold2_reached
        .get(source_provider)
        ?.has(source_provider_message_cid)
    ) {
      if (!ready_threshold2_reached.has(source_provider)) {
        ready_threshold2_reached.set(
          source_provider,
          new Set([source_provider_message_cid]),
        );
      } else {
        ready_threshold2_reached
          .get(source_provider)
          .add(source_provider_message_cid);
      }
      await rbc_store.set_resolved(
        manager,
        root_block_cid,
        epoch,
        source_provider,
        source_provider_message_cid,
      );

      resolveOne(source_provider);
    }
  }

  const dht_on_message: IDHTBroadcastHandler<RBCProtocolStage> = async function (
    sender,
    raw,
  ) {
    if (!raw) return;
    sub_transation(datasource_options, async (manager) => {
      const { subProtocol, msg, signature } = raw;
      const data = await get_rbc_data_from_raw(manager, sender, msg, signature);
      let restore_flag = false;
      if (data.epoch < epoch) {
        restore_flag = true;
      } else if (data.epoch > epoch + 1) {
        throw new Error('bad epoch');
      }

      if (subProtocol === RBCProtocolStage.RBC_VAL) {
        assert(
          data.stage === RBCProtocolStage.RBC_VAL &&
            data.piece instanceof Uint8Array &&
            typeof data.roothash === 'string' &&
            data.branch instanceof Array &&
            data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
            merkle_verify(
              data.piece,
              data.roothash,
              data.branch,
              await peer_store.get_peer_index(manager, node_id),
            ),
        );
        on_receive_val(manager, data, signature);
      } else if (subProtocol === RBCProtocolStage.RBC_ECHO) {
        assert(
          data.stage === RBCProtocolStage.RBC_ECHO &&
            (await peer_store.has_peer(manager, data.piece_receiver)) &&
            (await peer_store.has_peer(manager, data.piece_provider)) &&
            data.piece instanceof Uint8Array &&
            typeof data.roothash === 'string' &&
            data.branch instanceof Array &&
            data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
            merkle_verify(
              data.piece,
              data.roothash,
              data.branch,
              await peer_store.get_peer_index(manager, node_id),
            ),
        );
        on_receive_echo(manager, sender, data, signature);
      } else if (subProtocol === RBCProtocolStage.RBC_READY) {
        assert(
          data.stage === RBCProtocolStage.RBC_READY &&
            typeof data.cid === 'string' &&
            (await peer_store.has_peer(manager, data.provider)),
        );
        on_receive_ready(manager, sender, data, signature);
      }

      // 恢复机制：如果收到过期的epoch
      if (restore_flag) {
        // 返回当时的ready消息如果存在，即使roothash不同或cid不同
        const ready_data = await rbc_store.get_ready(
          manager,
          root_block_cid,
          epoch,
          sender,
          node_id,
        );
        if (ready_data) {
          const msg: RBCReadyMessage = {
            stage: RBCProtocolStage.RBC_READY,
            root_block_cid,
            sender,
            epoch,
            cid: ready_data.cid,
            provider: ready_data.sender,
          };
          const encoded_msg = await encode(msg);
          dht_helper.send(sender, {
            subProtocol: RBCProtocolStage.RBC_READY,
            msg: encoded_msg,
            signature: await sign(sk, encoded_msg),
          });
        }
      }
    });
  };
  dht_helper.addListener(RBCProtocolStage.RBC_VAL, dht_on_message);
  dht_helper.addListener(RBCProtocolStage.RBC_ECHO, dht_on_message);
  dht_helper.addListener(RBCProtocolStage.RBC_READY, dht_on_message);

  const pieces = ec.encode(await encode(input));
  const mtree = create_merkle_tree(pieces);
  const roothash = mtree[1];

  sub_transation(datasource_options, async (manager) => {
    const peers = await peer_store.get_peers(manager);
    for (const i of peers) {
      const resolved = await rbc_store.is_resolved(
        manager,
        root_block_cid,
        epoch,
        i.uuid,
      );
      if (resolved) {
        resolveOne(i.uuid);
      } else if (
        await rbc_store.has_ready(
          manager,
          root_block_cid,
          epoch,
          node_id,
          i.uuid,
        )
      ) {
        // 如果当前节点已经有关于 i.id 的ready消息
        const { cid } = await rbc_store.get_ready(
          manager,
          root_block_cid,
          epoch,
          node_id,
          i.uuid,
        );
        const msg: RBCReadyMessage = {
          stage: RBCProtocolStage.RBC_READY,
          sender: node_id,
          root_block_cid,
          epoch,
          cid: cid,
          provider: i.uuid,
        };
        broadcast(manager, dht_helper, sk, msg, RBCProtocolStage.RBC_READY);
      } else {
        // 重置关于i.id 的 val, echo 从头开始
        await rbc_store.reset_val(manager, root_block_cid, epoch, i.uuid);
        await rbc_store.reset_echo(manager, root_block_cid, epoch, i.uuid);

        const branch = get_merkle_branch(i.index, mtree);
        const msg: RBCValMessage = {
          stage: RBCProtocolStage.RBC_VAL,
          piece_receiver: i.uuid,
          piece_provider: node_id,
          root_block_cid,
          epoch,
          branch,
          roothash,
          piece: pieces[i.index],
        };
        send_val(manager, dht_helper, sk, i.uuid, msg);
      }
    }
  });
}

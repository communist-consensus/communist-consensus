import { tcp } from '@libp2p/tcp';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { PeerId } from '@libp2p/interface-peer-id';
import { peerIdFromKeys } from '@libp2p/peer-id';
import cryptoKeys from 'libp2p-crypto/src/keys';
import { fromString } from 'uint8arrays/from-string';
import { bootstrap } from '@libp2p/bootstrap';
import { createLibp2p } from 'libp2p';
import { identifyService } from 'libp2p/identify'
import { webSockets } from '@libp2p/websockets';
import { kadDHT } from '@libp2p/kad-dht';
import { noise } from '@chainsafe/libp2p-noise';
import * as peer_store from '../database/peer';
import * as block_store from '../database/block';
import * as rbc_store from '../database/rbc';
import * as aba_store from '../database/aba';
import {
  ABAProof,
  ABAProtocolStage,
  ABAValue,
  Action,
  Actions,
  ConsensusConfig,
  Context,
  DBBlock,
  ABAFinalVoteMessage as ABAFinalVoteMessage,
  IDHTBroadcastHandler,
  IDHTHelperCommonMessage,
  IDatabase,
  IPFSAddress,
  IRBCProof,
  IRBCWorkerInitialData,
  MassActions,
  NodeID,
  Profile,
  RBCFromWorkerMessage,
  RBCFromWorkerMessageType,
  RBCProof,
  RBCProtocolStage,
  RBCProtocols,
  RBCRPCScope,
  RBCReadyMessage,
  RBCToWorkerMessage,
  RBCToWorkerMessageType,
  SubProtocols,
  BFTEvents,
} from '../types';
import { mplex, MplexInit } from '@libp2p/mplex';
import { Multiaddr, multiaddr } from '@multiformats/multiaddr';
import debug from 'debug';
import {
  b64pad_to_uint8array,
  encode,
  shuffle,
  shuffle_by_string,
  sign,
  sleep,
  verify,
} from '../utils';
import { ConnectionManagerInit } from 'libp2p/src/connection-manager';
import { createDatabase } from '../database';
import createDataStore from '../datastore';
import createQuadraticABA from './quadratic-aba';
import { join, dirname } from 'path';
import createDHTHelper from '../dht-helper';
import { apply_block } from '../blockchain/apply_block';
import apply_actions from '../blockchain/apply_actions';
import { sub_transation } from '../database/utils';
import { EntityManager } from 'typeorm';
import { EventEmitter } from 'tsee';

export async function createContext(
  config: ConsensusConfig,
  options:
    | {
        mode: 'init-initiator';
        initial_actions: Actions;
        start_timestamp: number;
        interval: number;
      }
    | {
        mode: 'init-participant';
        root_block_cid: IPFSAddress<DBBlock>;
        target_block_cid: IPFSAddress<DBBlock>;
      }
    | {
        mode: 'resume';
      },
) {
  const peerId = await peerIdFromKeys(
    b64pad_to_uint8array(config.public_key),
    b64pad_to_uint8array(config.private_key),
  );

  const log = debug(`waterbear-${peerId.toString().substring(30)}`);

  const mplex_config: MplexInit = {
    maxInboundStreams: 10,
    maxOutboundStreams: 10,
    maxUnprocessedMessageQueueSize: 1000 * 1000, // bytes
    maxStreamBufferSize: 1000 * 1000, // bytes
    disconnectThreshold: 1,
  };
  const connection_manage_config: ConnectionManagerInit = {
    // autoDial: true,
    autoDialInterval: 1000 * 60 * 4,
    inboundUpgradeTimeout: 1000 * 5,
    maxConnections: 100,
    maxIncomingPendingConnections: 100,
    minConnections: 0,
    inboundConnectionThreshold: 20,
    // pollInterval: 1000 * 60,
    maxParallelDials: 100,
    // maxAddrsToDial: 3,
    dialTimeout: 1000 * 10,
    // maxDialsPerPeer: 1,
    allow: [], // always accept
    deny: [], // always reject
  };

  const db = await createDatabase(peerId.toString());
  if (options.mode == 'init-initiator' || options.mode == 'init-participant') {
    await db.clear();
  }
  const N = 1;

  const dht = kadDHT({
    kBucketSize: 20,
    clientMode: false,
    allowQueryWithZeroPeers: true,
    selectors: {},
    validators: {},
    protocolPrefix: '/cc-libp2p-dht',
    maxInboundStreams: 10,
    maxOutboundStreams: 10,
    providers: {},
  });
  const node = await createLibp2p({
    // libp2p nodes are started by default, pass false to override this
    // start: true,
    peerId,
    connectionManager: connection_manage_config,
    peerStore: {
      addressFilter: async (peerId, multiaddr) => {
        if (
          await peer_store.has_peer(ctx.datasource.manager, peerId.toString())
        )
          return true;
        else {
          log('unknown peer', peerId);
          return false;
        }
      },
    },
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/0`],
    },
    /**
     * An optional datastore to persist peer information, DHT records, etc.
     *
     * An in-memory datastore will be used if one is not provided.
     */
    datastore: createDataStore(db.datasource.manager),
    transports: [
      tcp({
        inboundSocketInactivityTimeout: 1000 * 60 * 10, // ms
        outboundSocketInactivityTimeout: 1000 * 60 * 10, // ms
        maxConnections: 100,
      }),
    ],
    connectionGater: {
      denyDialPeer: async () => await Promise.resolve(false),
      denyDialMultiaddr: async () => await Promise.resolve(false),
      denyInboundConnection: async () => await Promise.resolve(false),
      denyOutboundConnection: async () => await Promise.resolve(false),
      denyInboundEncryptedConnection: async () => await Promise.resolve(false),
      denyOutboundEncryptedConnection: async () => await Promise.resolve(false),
      denyInboundUpgradedConnection: async () => await Promise.resolve(false),
      denyOutboundUpgradedConnection: async () => await Promise.resolve(false),
      filterMultiaddrForPeer: async () => await Promise.resolve(true),
    },
    // peerDiscovery: [dht],
    // peerRouters: [dht],
    // contentRouters: [dht],
    // dht: dht,
    services: {
      dht,
      identify: identifyService()
    },
    connectionEncryption: [noise()],
    streamMuxers: [mplex(mplex_config)],
  });

  log(
    `the max amount of memory buffered by libp2p is approximately: ${
      (connection_manage_config.maxConnections! *
        (mplex_config.maxUnprocessedMessageQueueSize! +
          mplex_config.maxInboundStreams! * mplex_config.maxStreamBufferSize! +
          mplex_config.maxOutboundStreams! * mplex_config.maxStreamBufferSize!)) /
      1000000
    } MB`,
  );

  const ctx: Context = {
    N,
    f: 0,
    epoch: 0,
    libp2p_node: node,
    node_id: peerId.toString(),
    pk: peerId.publicKey!,
    start_timestamp: 0,
    interval: Infinity,
    sk: peerId.privateKey!,
    datasource: db.datasource,
    root_block_cid: '',
    prev_block_cid: '',
    ee: new EventEmitter<BFTEvents>(),
  };
  ctx.log = log;

  node.handle('/rbc/1.0.0', ({ stream, connection }) => {}, {
    maxInboundStreams: 10,
    maxOutboundStreams: 10,
  });
  node.handle('/waterbear-aba/1.0.0', ({ stream, connection }) => {}, {
    maxInboundStreams: 10,
    maxOutboundStreams: 10,
  });

  node.addEventListener('peer:connect', (connection) => {
    log('Connected to %s', connection.detail.toString());
    // TODO if valid
    // node.peerStore.addressBook.add(connection.detail.remotePeer, [
    //   connection.detail.remoteAddr,
    // ]);
  });
  node.addEventListener('peer:disconnect', (connection) => {
    log('Disconnected %s', connection.detail.toString());
  });
  node.addEventListener('peer:discovery', (peer) => {
    log('Discovered %s', peer.detail.id, peer.detail.multiaddrs); // Log discovered peer
  });

  const listenAddrs = node.getMultiaddrs();
  ctx.log!('libp2p is listening on the following addresses: ', listenAddrs);
  ctx.libp2p_node = node;

  ctx.dht_helper = createDHTHelper(ctx);

  if (options.mode == 'init-initiator') {
    ctx.N = 1;
    ctx.start_timestamp = options.start_timestamp;
    ctx.interval = options.interval;
    await sub_transation(ctx.datasource.options, async (manager) => {
      await peer_store.add_peer(manager, config);
      await aba_store.set_current_info(manager, {
        root_block_cid: ctx.root_block_cid,
        epoch: ctx.epoch,
        round: 0,
        stage: ABAProtocolStage.ABA_DECIDED,
        session_id: ctx.node_id,
        val: ABAValue.true,
      });
      const aba_final_vote: ABAFinalVoteMessage = {
        sender: ctx.node_id,
        epoch: ctx.epoch,
        round: 0,
        stage: ABAProtocolStage.ABA_FINALVOTE,
        session_id: ctx.node_id,
        root_block_cid: ctx.root_block_cid,
        val: ABAValue.true,
      };
      await aba_store.set_final_vote(
        manager,
        aba_final_vote,
        await sign(ctx.sk, await encode(aba_final_vote)),
      );
      const actions_cid = await ctx.dht_helper!.provide!(
        await encode(options.initial_actions),
      );
      await rbc_store.set_resolved(
        manager,
        ctx.root_block_cid,
        ctx.epoch,
        ctx.node_id,
        actions_cid,
      );
      const rbc_ready_msg: RBCReadyMessage = {
        root_block_cid: ctx.root_block_cid,
        stage: RBCProtocolStage.RBC_READY,
        epoch: ctx.epoch,
        provider: ctx.node_id,
        sender: ctx.node_id,
        cid: actions_cid,
      };
      const rbc_ready_signature = await sign(
        ctx.sk,
        await encode(rbc_ready_msg),
      );
      rbc_store.set_ready(
        manager,
        rbc_ready_msg,
        Buffer.from(rbc_ready_signature),
      );
      const block_cid = await add_block(ctx, manager, [
        {
          node_id: ctx.node_id,
          actions: options.initial_actions,
        },
      ]);
      await apply_actions(ctx, manager, [
        { node_id: ctx.node_id, actions: options.initial_actions },
      ]);

      ctx.prev_block_cid = block_cid;
      ctx.root_block_cid = block_cid;
      ++ctx.epoch;
      ctx.N = await peer_store.get_n_peer(manager);
      ctx.f = Math.floor((ctx.N - 1) / 3);
      ctx.start_timestamp += ctx.interval;
      ctx.ee.emit('new_block', block_cid);
    });
  } else if (options.mode == 'init-participant') {
    let cur_block_cid = options.target_block_cid;
    const block_chain: {
      block: DBBlock;
      aba_proofs: ABAProof[];
      rbc_proofs: RBCProof[];
    }[] = [];
    while (cur_block_cid) {
      const block = await ctx.dht_helper.get<DBBlock>(cur_block_cid);
      const aba_proofs = await ctx.dht_helper.get<ABAProof[]>(block.aba_proofs);
      const rbc_proofs = await ctx.dht_helper.get<RBCProof[]>(block.rbc_proofs);
      block_chain.unshift({ block, aba_proofs, rbc_proofs });
      cur_block_cid = block.prev_block_cid;
      // TODO verify proofs
    }
    if (
      block_chain.length &&
      block_chain[0].block.block_cid == options.root_block_cid
    ) {
      while (block_chain.length) {
        const { block, aba_proofs, rbc_proofs } = block_chain.shift();
        await apply_block(ctx, block, rbc_proofs, aba_proofs);
      }
    } else {
      throw new Error('invalid root_block_cid');
    }
    ctx.root_block_cid = options.root_block_cid;
  } else if (options.mode === 'resume') {
    // TODO
  }
  return ctx;
}

export async function startWaterbear(
  ctx: Context,
  get_input: () => Promise<Action[]>,
) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  while (true) {
    await sub_transation(ctx.datasource.options, async (manager) => {
      const input = await get_input();
      const { node_id, epoch, N, f, dht_helper, sk, root_block_cid } = ctx;

      const worker_initial_data: IRBCWorkerInitialData = {
        root_block_cid,
        node_id,
        epoch,
        N,
        datasource_options: { ...ctx.datasource.options, entities: [] },
        f,
        input,
        sk,
      };
      const rbc_worker = new Worker(join(__dirname, './rbc_worker.ts'), {
        workerData: worker_initial_data,
      });

      const listeners: {
        subProtocol: RBCProtocols;
        cb: IDHTBroadcastHandler<RBCProtocols>;
      }[] = [];
      let rbc_n_resolved = 0;
      let rbc_ignore_flag = false;

      await new Promise<void>(async (resolve) => {
        let aba_n_resolved = 0;
        const aba_cb = (node_id: NodeID, val: boolean) => {
          ++aba_n_resolved;
          if (aba_n_resolved == N) {
            resolve();
          }
        };
        rbc_worker.on('message', async (msg: RBCFromWorkerMessage) => {
          ctx.log!('from worker', msg);
          if (msg.type === RBCFromWorkerMessageType.resolveOne) {
            if (rbc_ignore_flag) return;
            ++rbc_n_resolved;
            // 如果大部分RBC完成，忽略剩下的RBC，对应的节点进入ABA（0）
            if (N - f <= rbc_n_resolved) {
              rbc_ignore_flag = true;
              rbc_store
                .get_resolved_node_ids(
                  ctx.datasource.manager,
                  ctx.root_block_cid,
                  epoch,
                )
                .then(async (node_ids) => {
                  for (const resolved_node_id of node_ids) {
                    const current = await aba_store.get_current_info(
                      ctx.datasource.manager,
                      root_block_cid,
                      epoch,
                      resolved_node_id,
                    );
                    if (!current) {
                      createQuadraticABA({
                        N,
                        f,
                        sk,
                        node_id,
                        epoch,
                        dht_helper: dht_helper!,
                        root_block_cid,
                        session_id: resolved_node_id,
                        datasource_options: ctx.datasource.options,
                        input: false,
                        cb: aba_cb,
                      });
                    }
                  }
                });
            } else {
              createQuadraticABA({
                N,
                f,
                sk,
                node_id,
                root_block_cid,
                epoch,
                dht_helper: dht_helper!,
                datasource_options: ctx.datasource.options,
                session_id: msg.node_id,
                input: true,
                cb: aba_cb,
              });
            }
          } else if (msg.type === RBCFromWorkerMessageType.rpc) {
            if (msg.scope === RBCRPCScope.dht_helper) {
              const res = await ctx.dht_helper![msg.fn](...msg.args);
              if (msg.call_id) {
                const msg_to_worker: RBCToWorkerMessage = {
                  type: RBCToWorkerMessageType.RPCResponse,
                  call_id: msg.call_id,
                  data: res,
                };
                rbc_worker.postMessage(msg_to_worker);
              }
            }
          } else if (msg.type === RBCFromWorkerMessageType.addListener) {
            const cb: IDHTBroadcastHandler<RBCProtocols> = (
              peer,
              msg,
              connection,
              stream,
            ) => {
              const msg_to_worker: RBCToWorkerMessage = {
                type: RBCToWorkerMessageType.RBCinternal,
                peer,
                ...msg,
              };
              rbc_worker.postMessage(msg_to_worker);
            };
            listeners.push({ subProtocol: msg.subProtocol, cb });
            ctx.dht_helper!.addListener(msg.subProtocol, cb as IDHTBroadcastHandler<SubProtocols>);
          }
        });
      });

      let mass_actions: MassActions = [];
      for (const peer of await peer_store.get_peers(ctx.datasource.manager)) {
        const info = (await aba_store.get_current_info(
          ctx.datasource.manager,
          root_block_cid,
          epoch,
          peer.uuid,
        ))!;
        if (
          info.stage === ABAProtocolStage.ABA_DECIDED &&
          info.val === ABAValue.true
        ) {
          const cid = await rbc_store.get_resolved_cid(
            ctx.datasource.manager,
            ctx.root_block_cid,
            epoch,
            peer.uuid,
          );
          mass_actions.push({
            node_id: peer.uuid,
            actions: await ctx.dht_helper!.get(cid),
          });
        }
      }
      mass_actions = shuffle_by_string(mass_actions, ctx.prev_block_cid);

      const block_cid = await add_block(ctx, manager, mass_actions);
      await apply_actions(ctx, manager, mass_actions);

      await rbc_worker.terminate();
      listeners.forEach((i) =>
        ctx.dht_helper!.removeListener(i.subProtocol, i.cb as IDHTBroadcastHandler<SubProtocols>),
      );

      if (!ctx.root_block_cid) ctx.root_block_cid = block_cid;
      ctx.prev_block_cid = block_cid;
      ++ctx.epoch;
      ctx.N = await peer_store.get_n_peer(manager);
      ctx.f = Math.floor((ctx.N - 1) / 3);
      ctx.start_timestamp += ctx.interval;

      ctx.ee.emit('new_block', block_cid);
    });

    const now = Date.now();
    if (now < ctx.start_timestamp) {
      await sleep(ctx.start_timestamp - now);
    }
  }
}

async function add_block(
  ctx: Context,
  manager: EntityManager,
  mass_actions: MassActions,
) {
  const aba_proofs: ABAProof[] = [];
  const rbc_proofs: RBCProof[] = [];
  for (const peer of await peer_store.get_peers(manager)) {
    const info = (await aba_store.get_current_info(
      manager,
      ctx.root_block_cid,
      ctx.epoch,
      peer.uuid,
    ))!;
    const final_vote_msgs = await aba_store.get_final_vote_msgs(
      manager,
      ctx.root_block_cid,
      ctx.epoch,
      peer.uuid,
      info.round,
    );
    aba_proofs.push({
      node_id: peer.uuid,
      round: info.round,
      val: info.val === ABAValue.true,
      signatures: final_vote_msgs.signatures.map((i, index) => ({
        signatory: final_vote_msgs.msgs[index].sender,
        signature: i,
      })),
    });

    if (info.val === ABAValue.true) {
      const cid = await rbc_store.get_resolved_cid(
        manager,
        ctx.root_block_cid,
        ctx.epoch,
        peer.uuid,
      );
      const rbc_ready_msgs = await rbc_store.get_ready_msgs(
        manager,
        ctx.root_block_cid,
        ctx.epoch,
        peer.uuid,
        cid,
      );
      rbc_proofs.push({
        node_id: peer.uuid,
        cid,
        signatures: rbc_ready_msgs.signatures.map((i, index) => ({
          signatory: rbc_ready_msgs.msgs[index].sender,
          signature: i,
        })),
      });
    }
  }
  const partial_block: Partial<DBBlock> = {
    prev_block_cid: ctx.prev_block_cid,
    epoch: ctx.epoch,
    start_timestamp: ctx.start_timestamp,
    mass_actions: await ctx.dht_helper!.provide!(await encode(mass_actions)),
  };
  const block_cid = await ctx.dht_helper!.provide!(await encode(partial_block));
  await block_store.add_block(manager, {
    block_cid,
    aba_proofs: await ctx.dht_helper!.provide!(await encode(aba_proofs)),
    rbc_proofs: await ctx.dht_helper!.provide!(await encode(rbc_proofs)),
    ...(partial_block as DBBlock),
  });
  return block_cid;
}

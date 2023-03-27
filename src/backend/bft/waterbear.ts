import { tcp } from '@libp2p/tcp';
import { PeerId } from '@libp2p/interface-peer-id';
import { peerIdFromKeys } from '@libp2p/peer-id';
import cryptoKeys from 'libp2p-crypto/src/keys';
import { fromString } from 'uint8arrays/from-string';
import { bootstrap } from '@libp2p/bootstrap';
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { kadDHT } from '@libp2p/kad-dht';
import { noise } from '@chainsafe/libp2p-noise';
import { ABAValue, ConsensusConfig, Context, IABAPRoof, IDatabase, IRBCProof, NodeID } from '../types';
import { mplex, MplexInit } from '@libp2p/mplex';
import { Multiaddr } from '@multiformats/multiaddr';
import debug from 'debug';
import { b64pad_to_uint8array, encode } from '../utils';
import { ConnectionManagerInit } from 'libp2p/src/connection-manager';
import createDataBase, { createDBManager } from '../database';
import createDataStore from '../datastore';
import {
  KeyQuery,
  Query,
  Pair,
  Datastore,
  Options,
  Key,
} from 'interface-datastore';
import startP2PBroadcastProtocal from '../p2pbroadcast';
import createProvableReliableBroadcast from './rbc';
import { IABAEvents, IRBCEvents } from '../types';
import { EventEmitter } from 'tsee';
import createAsyncBinaryAgreement from './aba';
import createQuadraticABA from './quadratic-aba';
import createContentDeliverer from '../content-deliverer';
import { EmbeddedMetadata } from 'typeorm/metadata/EmbeddedMetadata';

export async function createContext(config: ConsensusConfig, reset_db = false) {
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
    autoDial: true,
    autoDialInterval: 1000 * 60 * 4,
    inboundUpgradeTimeout: 1000 * 5,
    maxConnections: 100,
    maxIncomingPendingConnections: 100,
    minConnections: 0,
    inboundConnectionThreshold: 20,
    pollInterval: 1000 * 60,
    maxParallelDials: 100,
    maxAddrsToDial: 3,
    dialTimeout: 1000 * 10,
    maxDialsPerPeer: 1,
    allow: [], // always accept
    deny: [], // always reject
  };

  const db = await createDataBase(peerId.toString());
  if (reset_db) {
    await db.clear();
  }
  const datastore = createDataStore(db.connection);

  const node = await createLibp2p({
    // libp2p nodes are started by default, pass false to override this
    start: false,
    peerId,
    connectionManager: connection_manage_config,
    peerStore: {
      addressFilter: async (peerId, multiaddr) => {
        if (ctx.peer_ids[peerId.toString()]) return true;
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
    datastore,
    dht: kadDHT({
      kBucketSize: 20,
      clientMode: false,
      selectors: {},
      validators: {},
      protocolPrefix: '/cc-libp2p-dht',
      maxInboundStreams: 10,
      maxOutboundStreams: 10,
      providers: {},
    }),
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
    connectionEncryption: [noise()],
    streamMuxers: [mplex(mplex_config)],
  });

  await node.peerStore.addressBook.delete(peerId);

  log(
    `the max amount of memory buffered by libp2p is approximately: ${
      (connection_manage_config.maxConnections *
        (mplex_config.maxUnprocessedMessageQueueSize +
          mplex_config.maxInboundStreams * mplex_config.maxStreamBufferSize +
          mplex_config.maxOutboundStreams * mplex_config.maxStreamBufferSize)) /
      1000000
    } MB`,
  );

  // TODO restoreFromDB
  let ctx: Context = {
    N: 1,
    f: 0,
    epoch: 0,
    libp2p_node: node,
    node_id: peerId.toString(),
    pk: peerId.publicKey,
    sk: peerId.privateKey,
    db,
    content_deliverer: await createContentDeliverer(node),
    node_id_to_index: {[peerId.toString()]: 0},
    peer_ids: {
      [peerId.toString()]: peerId,
    },
    PKs: {
      [peerId.toString()]: peerId.publicKey,
    },
  };

  ctx.log = log;

  node.handle('/ecrbc/1.0.0', ({ stream, connection }) => {}, {
    maxInboundStreams: 10,
    maxOutboundStreams: 10,
  });
  node.handle('/waterbear-aba/1.0.0', ({ stream, connection }) => {}, {
    maxInboundStreams: 10,
    maxOutboundStreams: 10,
  });

  // start libp2p
  await node.start();
  node.addEventListener('peer:connect', (connection) => {
    log('Connected to %s', connection.detail.remotePeer.toString());
    // TODO if valid
    // node.peerStore.addressBook.add(connection.detail.remotePeer, [
    //   connection.detail.remoteAddr,
    // ]);
  });
  node.addEventListener('peer:disconnect', (connection) => {
    log('Disconnected %s', connection.detail.remotePeer.toString());
  });
  node.addEventListener('peer:discovery', (peer) => {
    log('Discovered %s', peer.detail.id, peer.detail.multiaddrs); // Log discovered peer
  });

  const listenAddrs = node.getMultiaddrs();
  ctx.log('libp2p is listening on the following addresses: ', listenAddrs);
  ctx.libp2p_node = node;

  return ctx;
}

export async function addBootstrapNode(
  ctx: Context,
  bootstrapPeerId: PeerId,
  addrs: Multiaddr[],
) {
  ctx.log('bootstrapPeerId', bootstrapPeerId);

  ctx.PKs[bootstrapPeerId.toString()] = bootstrapPeerId.publicKey;
  ctx.peer_ids[bootstrapPeerId.toString()] = bootstrapPeerId;
  ctx.node_id_to_index = Object.keys(ctx.peer_ids)
    .sort((a, b) => (a > b ? 1 : -1))
    .reduce((a, i, idx) => {
      a[i] = idx;
      return a;
    }, {});
  ctx.N = Object.keys(ctx.PKs).length;

  ctx.p2pbroadcast_protocol = startP2PBroadcastProtocal(ctx);

  await ctx.libp2p_node.peerStore.addressBook.set(bootstrapPeerId, addrs);
}


export async function startWaterbear(ctx: Context, get_input: () => Promise<Uint8Array>) {
  while (true) {
    const input = await get_input();
    const {
      node_id_to_index,
      node_id,
      peer_ids,
      epoch,
      N,
      db,
      f,
      p2pbroadcast_protocol,
      content_deliverer,
      PKs,
      sk,
    } = ctx;
    const node_ids = Object.keys(node_id_to_index);
    const rbc_ee = new EventEmitter<IRBCEvents>();
    const db_manager = createDBManager(ctx)
    createProvableReliableBroadcast({
      node_id,
      node_ids,
      epoch,
      N,
      store: db_manager.rbc,
      f,
      input,
      node_id_to_index,
      PKs,
      sk,
      p2pbroadcast_protocol,
      content_deliverer,
      ee: rbc_ee,
    });

    rbc_ee.on('resolveOne', async (resovled_node_id, proof) => {
      if (
        (await db_manager.aba.has_prevote(
          epoch,
          resovled_node_id,
          0,
          node_id,
          ABAValue.false,
        )) ||
        (await db_manager.aba.has_prevote(
          epoch,
          resovled_node_id,
          0,
          node_id,
          ABAValue.false,
        ))
      ) return;

      ctx.log('resolvedOne', resovled_node_id);

      const aba_ee = createQuadraticABA({
        N,
        f,
        sk,
        epoch,
        node_id,
        store: db_manager.aba,
        p2pbroadcast_protocol,
        session_id: resovled_node_id,
        input: true,
      });
      if (N - f <= resolvedRBC.size) {
        RBCResolvedAll = true;
        rbc_ee.emit('abort');
        node_ids.forEach((i) => {
          if (!resolvedRBC.get(i)) {
            const aba_ee = new EventEmitter<IABAEvents>();
            createQuadraticABA({
              N,
              f,
              sk,
              node_id,
              epoch,
              store: db_manager.aba,
              p2pbroadcast_protocol,
              session_id: resovled_node_id,
              input: false,
              ee: aba_ee,
            });
          }
        });
      }
    });

    await new Promise(resolve => aba_resolve_all_ee.once('resolve_all', () => resolve(null)));

    console.log({
      resolvedABA,
      resolvedRBC,
    });
    ++ctx.epoch;
  }
}
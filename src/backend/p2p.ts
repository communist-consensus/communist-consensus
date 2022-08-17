import PeerId from 'peer-id';
import getPort from 'get-port';
import readline from 'readline';
import { gen_id } from './utils';
import Blockchain from './blockchain';
import IPFS from './ipfs';
import Database from './database';
import Libp2p from 'libp2p';
import { NOISE } from 'libp2p-noise';
import MPLEX from 'libp2p-mplex';
import Bootstrap from 'libp2p-bootstrap';
import TCP from 'libp2p-tcp';
import KadDHT from 'libp2p-kad-dht';
import { get_now, uint8array_to_b58 } from '../shared/utils';
import { PROTOCOL } from './constant';
import IP from 'ip';
import AddressChecker from './address-checker';
import NetworkDetect from './network-detect';
import DynamicRelay from './dynamic-relay';
import debug from 'debug';
import RIDataStore from './datastore';
import ConsensusProtocol from './consensus';
import { Actions, ActionType, Context, IIPFS, PeerJSON, Profile, RIConfig, RILibp2p, VITaskType } from '../shared/types';
import { MultiaddrConnection } from 'libp2p/src/upgrader';
import EventEmitter from 'events';

let ipfs: IIPFS;

const blockchains = new Map<string, Blockchain>();
export async function init(config: RIConfig, opt: {
  clear_db?: boolean,
} = {
  clear_db: false,
}) {
  const { my_peer_json, bootstrap_public_key } = config;
  const bootstrap_peer = bootstrap_public_key
    ? await PeerId.createFromPubKey(bootstrap_public_key)
    : undefined;
  const bootstrap_peer_mid = bootstrap_public_key
    ? uint8array_to_b58(bootstrap_peer.id)
    : undefined;

  const peerId = await PeerId.createFromJSON(my_peer_json);
  const log = debug(`blockchain-${peerId.toB58String().substr(0, 6)}`);

  const ctx_utils = {
    gen_id: () => '',
    random: () => Math.random(),
  };
  ctx_utils.gen_id = () => gen_id(ctx_utils.random);
  const ctx: Context = {
    config,
    ee: new EventEmitter(),
    libp2p: undefined,
    ipfs: undefined,
    db: undefined,
    utils: ctx_utils,
    log: (...args) => {
      log(ctx.pending_block ? ctx.pending_block.cycle_id : -1, ...args);
    },
    port: undefined,
    p2p_address: undefined,
  };

  const db = await Database.create(ctx);
  ctx.db = db;
  if (opt.clear_db) {
    await db.clear();
  }
  // const datastore = new RIDataStore(db.connection);
  if (!ipfs) {
    ipfs = await IPFS.create();
  }
  ctx.ipfs = ipfs;

  const local_ip = IP.address();
  let port = config.port;
  if (!port) {
    port = await getPort();
  }
  ctx.port = port;
  ctx.p2p_address = `/ip4/${local_ip}/tcp/${port}/p2p/${peerId.toB58String()}`;
  const node = (await Libp2p.create({
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${port}`],
    },
    peerId,
    // datastore: datastore,
    peerStore: {
      persistence: true,
      threshold: 1,
    },
    modules: {
      transport: [TCP],
      connEncryption: [NOISE],
      streamMuxer: [MPLEX],
      peerDiscovery: [], // KadDHT is not compatible
      dht: KadDHT,
    },
    config: {
      protocolPrefix: PROTOCOL,
      dht: {
        kBucketSize: 20,
        enabled: true, // This flag is required for DHT to run (disabled by default)
        enabledDiscovery: true,
        randomWalk: {
          enabled: true,
          queriesPerPeriod: 1,
          interval: 300000,
          timeout: 30000,
          delay: 10000,
        },
        // TODO protocolPrefix 无效
        // protocolPrefix: `/${PROTOCOL}`,
      },
      peerDiscovery: {
        autoDial: false, // Auto connect to discovered peers (limited by ConnectionManager minConnections)
        // The `tag` property will be searched when creating the instance of your Peer Discovery service.
        // The associated object, will be passed to the service when it is instantiated.
        [Bootstrap.tag]: {
          enabled: false,
        },
      },
      relay: {
        enabled: true, // Allows you to dial and accept relayed connections. Does not make you a relay.
        hop: {
          enabled: true, // Allows you to be a relay for other peers
          active: true, // You will attempt to dial destination peers if you are not connected to them
        },
        advertise: {
          bootDelay: 15 * 60 * 1000, // Delay before HOP relay service is advertised on the network
          enabled: false, // Allows you to disable the advertise of the Hop service
          ttl: 30 * 60 * 1000, // Delay Between HOP relay service advertisements on the network
        },
        autoRelay: {
          enabled: true, // Allows you to bind to relays with HOP enabled for improving node dialability
          maxListeners: 2, // Configure maximum number of HOP relays to use
        },
      },
      pubsub: {
        enabled: false,
      },
      nat: {
        enabled: false,
      },
    },
    connectionGater: {
      denyInboundConnection: async (maConn: MultiaddrConnection) => {
        return false;
        // TODO
        /*
        const remote_mid = maConn.remoteAddr.getPeerId();
        if (remote_mid === bootstrap_peer_mid) {
          return false;
        }
        if (await db.peer.has(remote_mid)) {
          return false;
        }
        log('gater:denyInboundConnection', remote_mid);
        return true;
        */
      },
      denyOutboundConnection: async (peerId: PeerId) => {
        if (peerId.toB58String() === bootstrap_peer.toB58String()) {
          return false;
        }
        if (await db.peer.has(peerId.toB58String())) {
          return false;
        }
        log('gater:denyOutboundConnection', peerId.toB58String());
        return true;
      },
      filterMultiaddrForPeer: async (peer: PeerId) => {
        if (bootstrap_peer_mid && peer.toB58String() === bootstrap_peer_mid) {
          return true;
        } else if (peer.toB58String() === peerId.toB58String()) {
          return true;
        } else if (await db.peer.has(peer.toB58String())) {
          return true;
        }
        log('gate:filterMultiaddrForPeer:unknown peer:', peer.toB58String());
        return false;
      },
    },
    connectionManager: {
      maxConnections: 21 * 20,
    },
  } as any)) as RILibp2p;
  ctx.libp2p = node;
  node.network_detect = await NetworkDetect.create();
  node.address_checker = await AddressChecker.create(node);
  node.dynamic_relay = await DynamicRelay.create(node);
  node.consensus_protocol = await ConsensusProtocol.create(ctx);

  node.addressManager.addObservedAddr(`/ip4/${local_ip}/tcp/${port}`);
  // if (config.public_ip) {
  //   node.addressManager.addObservedAddr(`/ip4/${config.public_ip}/tcp/${port}`);
  // }

  node.connectionManager.on('peer:connect', (connection) => {
    log('Connected to %s', connection.remotePeer.toB58String());
    // TODO if valid
    node.peerStore.addressBook.add(connection.remotePeer, [
      connection.remoteAddr,
    ]);
  });
  node.connectionManager.on('peer:disconnect', (connection) => {
    log('Disconnected %s', connection.remotePeer.toB58String());
  });
  node.on('peer:discovery', (peer) => {
    log('Discovered %s', peer); // Log discovered peer
  });

  // start libp2p
  await node.start().catch((e) => {
    log(e);
  });
  log('libp2p has started');

  if (config.enable_dynamic_relay) {
    node.dynamic_relay.start_timer();
    node.dynamic_relay.update();
  } else {
    node.relay._advertiseService();
  }

  const blockchain = await Blockchain.create(ctx);
  blockchains.set(my_peer_json.id, blockchain);
  return blockchain;
}

export function get_instance(id: string) {
  return blockchains.get(id);
}
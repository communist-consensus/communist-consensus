import { toBuffer } from 'it-buffer';
import type { Multiaddr } from '@multiformats/multiaddr';
import { PeerId } from '@libp2p/interface-peer-id';
import { PROTOCOL } from '../constant';
import { pipe } from 'it-pipe';
import crypto from 'libp2p-crypto';
import { collect, consume } from 'streaming-iterables';
import {
  RILibp2p,
  Context,
  IP2PBroadcastProtocol as IP2PBroadcastProtocol,
} from '../types';
import { Connection, Stream } from '@libp2p/interface-connection';
import Libp2p from 'libp2p';
import {
  KBucketContact,
  ActionsTestimony,
  IKBucket,
  KBucketNode,
  BlockContext,
  P2PBroadcastProtocolOptions,
  PeerStatus,
  IPFSAddress,
  DBBlock,
  ConsensusEvent,
  IP2PBroadcastHandlerMap,
  IP2PBroadcastSubProtocolMessageWrapper,
  IP2PBroadcastHandler,
  NodeID,
} from '../../../shared/types';
import {
  broadcast_to_buckets,
  forward,
  compute_n_replica,
  forceGetConnection,
} from './utils';
import { decode, encode } from '../utils';

const protocol_name = 'p2pbroadcast';
const protocol_version = '1.0.0';

export default function startP2PBroadcastProtocal(
  ctx: Context,
  options?: P2PBroadcastProtocolOptions,
): IP2PBroadcastProtocol {
  const handlers: IP2PBroadcastHandlerMap<Uint8Array> = new Map();
  options = options || {
    success_rate: 0.9,
    up_rate: 0.7,
    expected_success_rate: 0.9,
  };
  ctx.libp2p_node.handle(
    `/${PROTOCOL}/${protocol_name}/${protocol_version}`,
    async ({ connection, stream }) => {
      const req_raw: any = await pipe(stream, collect);
      const msg = await decode<IP2PBroadcastSubProtocolMessageWrapper<any>>(
        req_raw[0].bufs[0],
      );
      if (handlers[msg.subProtocol]) {
        handlers[msg.subProtocol].forEach((i) => i(connection.remotePeer, msg, connection, stream));
      }
    },
  );

  async function send<T>(
    target: NodeID,
    msg: IP2PBroadcastSubProtocolMessageWrapper<T>,
  ) {
    const connection = await forceGetConnection(ctx, ctx.peer_ids[target]);
    if (!connection) {
      return;
    }
    const stream = await connection.newStream(
      `/${PROTOCOL}/${protocol_name}/${protocol_version}`,
    );
    await pipe([await encode(msg)], stream, stream, toBuffer, collect);
  }

  return {
    addListener<T>(
      subProtocol: string,
      handler: IP2PBroadcastHandler<T>,
    ) {
      if (!handlers[subProtocol]) {
        handlers[subProtocol] = [];
      }
      handlers[subProtocol].push(handler);
    },

    removeListener<T>(
      subProtocol: string,
      handler: IP2PBroadcastHandler<T>,
    ) {
      handlers[subProtocol] = handlers[subProtocol].filter(
        (i) => i !== handler,
      );
    },

    send,

    async broadcast<T>(msg: IP2PBroadcastSubProtocolMessageWrapper<T>) {
      await Promise.all(
        Object.keys(ctx.peer_ids)
          .filter((i) => i !== ctx.node_id)
          .map((i) => send(i, msg)),
      );
    },

    // TODO
    /*
    async kb_broadcast(msg: IP2PBroadcastProtocolDecodedMessage) {
      // TODO lan -> wan
      const kb: IKBucket = (ctx.libp2p_node.dht.lan.routingTable as any).kb;

      broadcast_to_buckets<IP2PBroadcastProtocolDecodedMessage>({
        kb,
        msg,
        k: compute_n_replica({
          n: ctx.N,
          ...options,
        }),
        send: (kbContact, id, msg) => {
          // TODO
        },
      });
    },
  */
  };
}

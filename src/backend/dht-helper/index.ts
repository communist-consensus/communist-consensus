import { toBuffer } from 'it-buffer';
import { create, urlSource } from 'kubo-rpc-client'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import { get_cid } from '../utils';
import { peerIdFromKeys } from '@libp2p/peer-id';
import * as peer_store from '../database/peer';
import { PROTOCOL } from '../constant';
import { pipe } from 'it-pipe';
import { collect, consume } from 'streaming-iterables';
import {
  Context,
  IDHTHelper,
} from '../types';
import {
  DHTBroadcastProtocolOptions as DHTHelperOptions,
  IDHTBroadcastHandlerMap,
  NodeID,
  IDHTHelperCommonMessage,
} from '../../../shared/types';
import {
  forceGetConnection,
} from './utils';
import { b64pad_to_uint8array, decode, encode } from '../utils';

const protocol_name = 'dht-helper';
const protocol_version = '1.0.0';

export default function createDHTHelper<T>(
  ctx: Context,
  options?: DHTHelperOptions,
): IDHTHelper<T> {
  const ipfs = create((process.env as any)['IPFS_HTTP_GATEWAY']);
  const handlers: IDHTBroadcastHandlerMap<T> = new Map();
  options = options || {
    success_rate: 0.9,
    up_rate: 0.7,
    expected_success_rate: 0.9,
  };
  ctx.libp2p_node!.handle(
    `/${PROTOCOL}/${protocol_name}/${protocol_version}`,
    async ({ connection, stream }) => {
      const req_raw: any = await pipe(stream, collect);
      const msg = await decode<IDHTHelperCommonMessage<T>>(req_raw[0].bufs[0]);
      if (handlers.get(msg.subProtocol)) {
        handlers
          .get(msg.subProtocol)!
          .forEach((i) =>
            i(connection.remotePeer.toString(), msg, connection, stream),
          );
      }
    },
  );

  async function send<T>(
    target: NodeID,
    common_msg: IDHTHelperCommonMessage<T>,
  ) {
    const connection = await forceGetConnection(
      ctx,
      await peerIdFromKeys(
        (await peer_store.get_peer(ctx.datasource.manager, target)).public_key,
      ),
    );
    if (!connection) {
      return;
    }
    const stream = await connection.newStream(
      `/${PROTOCOL}/${protocol_name}/${protocol_version}`,
    );
    await pipe([await encode(common_msg)], stream, stream, toBuffer, collect);
  }

  return {
    get: async <T>(cid) => {
      const data = await all(ipfs.cat(cid));
      return await decode(Buffer.concat(data)) as T;
    },
    provide: async (obj) => {
      const res = await ipfs.add(obj);
      return res.cid.toString();
    },
    addListener(subProtocol, handler) {
      if (!handlers.get(subProtocol)) {
        handlers.set(subProtocol, []);
      }
      handlers.get(subProtocol)!.push(handler);
    },

    removeListener(subProtocol, handler) {
      handlers.set(
        subProtocol,
        handlers.get(subProtocol)!.filter((i) => i !== handler),
      );
    },

    send,

    async broadcast<T>(msg: IDHTHelperCommonMessage<T>) {
      const peers = await peer_store.get_peers(ctx.datasource.manager);
      for (const peer of peers) {
        if (peer.uuid !== ctx.node_id) {
          send(peer.uuid, msg);
        }
      }
    },
  };
}
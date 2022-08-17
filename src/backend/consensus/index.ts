import { toBuffer } from 'it-buffer';
import { Multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import { PROTOCOL } from '../constant';
import { pipe } from 'it-pipe';
import crypto from 'libp2p-crypto';
import { collect, consume } from 'streaming-iterables';
import { RILibp2p, Context, IConsensusProtocol } from '../types';
import Libp2p from 'libp2p';
import {
  KBucketContact,
  BroadcastType,
  ActionsTestimony,
  IKBucket,
  KBucketNode,
  BlockContext,
  WitnessTestimony,
  ConsensusProtocolOptions,
  BlockCtxState,
  PeerStatus,
  IPFSAddress,
  NextBlockhashResCode,
  ResRequestNextBlock,
  DBBlock,
  RIPeerEvent,
} from '../../shared/types';
import { broadcast_to_buckets, forward, compute_n_replica } from './utils';
import { convertPeerId } from 'libp2p-kad-dht/src/utils.js';
import { decode, encode } from '../utils';
import { AHEAD_OF_ROOT_BLOCK, MIN_ONLINE_RATE } from '../../shared/constant';
import {
  validate_actions,
  validate_actions_testimony,
  validate_witness_testimony,
} from '../simple_validator';
import {
  b64_to_uint8array,
  compute_witness_broadcast_duration,
  RSA_sign,
  RSA_verify,
  uint8array_to_b64,
} from '../../shared/utils';

const protocols = {
  consensus: 'consensus',
};
const protocol_version = '1.0.0';

enum ReqType {
  next_block = 'next_block'
}
function get_kb(ctx: Context) {
  // TODO lan -> wan
  const kb: IKBucket = ctx.libp2p._dht._lan._routingTable.kb;
  return kb;
}

export default class ConsensusProtocol implements IConsensusProtocol {
  ctx: Context;
  options: ConsensusProtocolOptions;
  constructor(ctx: Context, options?: ConsensusProtocolOptions) {
    this.ctx = ctx;
    this.options = options || {
      success_rate: 0.9,
      up_rate: 0.7,
      expected_success_rate: 0.9,
    };
  }

  static async create(ctx: Context, options?: ConsensusProtocolOptions) {
    const cp = new ConsensusProtocol(ctx, options);
    cp.mount();
    return cp;
  }

  mount = () => {
    this.ctx.libp2p.handle(
      `/${PROTOCOL}/${protocols.consensus}/${protocol_version}`,
      async ({ connection, stream }) => {
        const req_raw: any = await pipe(stream, collect);
        const { reqType, args } = decode<{ reqType: ReqType; args: any }>(
          req_raw[0]._bufs[0],
        );
        if (this.handlers[reqType]) {
          await this.handlers[reqType]({
            connection,
            stream,
            args,
          });
        }
      },
    );
  };

  broadcast_one = [
    BroadcastType.broadcast_actions_testimony,
    BroadcastType.broadcast_witness_testimony,
  ].reduce((m, reqType) => {
    m[reqType] = async (
      target_contact: KBucketContact,
      src: Uint8Array,
      msg: any,
    ) => {
      const targetPeerId: PeerId = target_contact.peer;
      const connection = await this.ctx.libp2p.dial(targetPeerId);
      const { stream } = await connection.newStream(
        `/${PROTOCOL}/${protocols.consensus}/${protocol_version}`,
      );
      const [] = await pipe(
        [
          encode({
            reqType,
            args: msg,
          }),
        ],
        stream,
        stream,
        toBuffer,
        collect,
      );
    };
    return m;
  }, {} as { [key: string]: (target_contact: KBucketContact, src: Uint8Array, msg: any) => Promise<void> });

  handlers = {
    next_block: async ({ connection, stream, args }) => {
      const block_hash = args ? args.toString() : undefined;
      // this.ctx.log('request next block hash:incoming', block_hash);
      let res_code = NextBlockhashResCode.ok;
      const next: DBBlock = await this.ctx.db.get_next_block(block_hash);
      if (!next) {
        if (!block_hash) {
          res_code = NextBlockhashResCode.reqBlockNotExists;
        } else {
          const req_block = await this.ctx.db.get_block(block_hash);
          if (!req_block) {
            res_code = NextBlockhashResCode.reqBlockNotExists;
          } else {
            res_code = NextBlockhashResCode.nextBlockNotExists;
          }
        }
      }

      const res_request_next: ResRequestNextBlock = {
        code: res_code,
        next,
        pending_block:
          this.ctx.pending_block &&
          next &&
          this.ctx.pending_block.prev_block_hash === next.block_hash
            ? {
                cycle_id: this.ctx.pending_block.cycle_id,
                prev_block_hash: this.ctx.pending_block.prev_block_hash,
                n_peer: this.ctx.pending_block.n_peer,
                min_witness_broadcast_window: this.ctx.pending_block
                  .min_witness_broadcast_window,
                min_actions_broadcast_window: this.ctx.pending_block
                  .min_actions_broadcast_window,
                witness_broadcast_window_end: this.ctx.pending_block
                  .witness_broadcast_window_end,
                witness_broadcast_window_start: this.ctx.pending_block
                  .witness_broadcast_window_start,
                actions_broadcast_window_end: this.ctx.pending_block
                  .actions_broadcast_window_end,
                actions_broadcast_window_start: this.ctx.pending_block
                  .actions_broadcast_window_start,
                action_bundle_cid: this.ctx.pending_block.action_bundle_cid,
                action_subjects_cid: this.ctx.pending_block.action_subjects_cid,
                action_signatures_cid: this.ctx.pending_block
                  .action_signatures_cid,
              }
            : undefined,
      };
      await pipe([encode(res_request_next)], stream, consume);
    },
    [BroadcastType.broadcast_actions_testimony]: async ({
      stream,
      args,
      connection,
    }) => {
      const kb: IKBucket = get_kb(this.ctx);
      const remotePeer = connection.remotePeer;
      const src = await convertPeerId(remotePeer);
      const { actions_testimony, signature } = decode<{
        actions_testimony: ActionsTestimony;
        signature: Uint8Array;
      }>(args);
      if (!validate_actions_testimony(actions_testimony)) {
        this.ctx.log(
          'broadcast actions testimony:incoming:invalid actions testimony',
        );
        return;
      }
      if (
        (await this.ctx.db.peer.get_status(actions_testimony.mid)) !==
        PeerStatus.active
      ) {
        this.ctx.log('broadcast actions testimony:incoming:invalid member');
        return;
      }
      const latest_block = await this.ctx.db.get_latest_block();
      if (!latest_block) {
        this.ctx.log('broadcast actions testimony:incoming:not ready');
        return;
      }
      if (
        actions_testimony.before_prev_block_hash !== latest_block.block_hash
      ) {
        this.ctx.log('broadcast actions testimony:incoming:invalid block_hash');
        return;
      }
      if (
        await this.ctx.db.cache.is_actions_testimony_forwarded(
          actions_testimony.mid,
        )
      ) {
        this.ctx.log('broadcast actions testimony:incoming:forwarded');
        return;
      }
      await this.ctx.db.cache.set_actions_testimony_forwarded(
        actions_testimony.mid,
      );
      if (this.ctx.config.my_peer_json.id !== actions_testimony.mid) {
        this.ctx.pending_block.next.action_bundle.push(
          actions_testimony.actions,
        );
        this.ctx.pending_block.next.action_subjects.push(actions_testimony.mid);
        this.ctx.pending_block.next.action_signatures.push(signature);
      }
      const n_peer = await this.ctx.db.peer.get_n_known_peers();
      const k = compute_n_replica({
        n: n_peer,
        ...this.options,
      });
      forward({
        k,
        kb,
        broadcast_one: this.broadcast_one[
          BroadcastType.broadcast_actions_testimony
        ],
        msg: args,
        src,
      });
    },
    /**
     * 缓存机制
     * remote.n_tries - local.n_tries === 1 进入缓存
     * 当 n_tries 变化时调用
     */
    [BroadcastType.broadcast_witness_testimony]: async ({
      stream,
      args,
      connection,
    }: {
      stream: any;
      connection: any;
      args: Uint8Array;
    }) => {
      const remotePeer = connection.remotePeer;
      const src = await convertPeerId(remotePeer);
      const { testimony_cid, signature } = decode<{
        testimony_cid: IPFSAddress;
        signature: Uint8Array;
      }>(args);
      const witness_testimony = await this.ctx.ipfs.get<WitnessTestimony>(
        testimony_cid,
      );
      const mid = remotePeer.toB58String();
      // this.ctx.log('receive testimony', testimony_cid);
      if (!validate_witness_testimony(witness_testimony)) {
        this.ctx.log(
          'broadcast witness testimony:incoming:invalid witness testimony',
        );
        return;
      }
      if ((await this.ctx.db.peer.get_status(mid)) !== PeerStatus.active) {
        this.ctx.log('broadcast witness testimony:incoming:invalid member');
        return;
      }
      const pending_block = this.ctx.pending_block;
      if (!pending_block) {
        this.ctx.log('broadcast witness testimony:incoming:not ready');
        return;
      }
      if (witness_testimony.prev_block_hash !== pending_block.prev_block_hash) {
        this.ctx.log('broadcast witness testimony:incoming:invalid block_hash');
        return;
      }
      if (
        await this.ctx.db.cache.is_witness_testimony_forwarded(
          testimony_cid,
          mid,
        )
      ) {
        this.ctx.log('broadcast witness testimony:incoming:forwarded');
        return;
      }

      const n_peer = await this.ctx.db.peer.get_n_known_peers();
      const before_pending_block = await this.ctx.db.get_block(
        pending_block.prev_block_hash,
      );
      const { n_tries } = compute_witness_broadcast_duration(
        pending_block.min_witness_broadcast_window,
        n_peer,
        pending_block.cycle_id === 0
          ? pending_block.actions_broadcast_window_end
          : before_pending_block.witness_broadcast_window_end,
      );

      if (n_tries !== witness_testimony.n_tries) {
        this.ctx.log('broadcast witness testimony:incoming:invalid n_tries');
        return;
      }

      this.ctx.log('broadcast witness testimony:incoming:cache');
      await this.ctx.db.cache.set_witness_testimony_cache(mid, {
        witness_testimony,
        args,
        src,
      });

      if (
        !(await RSA_verify(
          crypto.keys.unmarshalPublicKey(
            await this.ctx.db.peer.get_pubkey_by_mid(mid),
          ),
          encode(testimony_cid),
          signature,
        ))
      ) {
        this.ctx.log('broadcast witness testimony:incoming:invalid signature');
        return;
      }

      const signature_cid = await this.ctx.ipfs.add(signature);
      await this.ctx.db.cache.set_witness_testimony_forwarded(
        testimony_cid,
        mid,
        signature_cid,
        signature,
      );

      const n_member = await this.ctx.db.peer.get_n_known_peers();
      const n_supporter = await this.ctx.db.cache.count_witnesses(
        testimony_cid,
      );
      if (n_supporter > MIN_ONLINE_RATE * n_member) {
        this.ctx.ee.emit(
          RIPeerEvent.internal_final_witness_testimony_cid,
          testimony_cid,
        );
      }

      this.do_forward_witness_testimony(args, src, n_member);
    },
  };

  do_forward_witness_testimony = async (
    args: Uint8Array,
    src: Uint8Array,
    n_peer: number,
  ) => {
    const kb: IKBucket = get_kb(this.ctx);
    const k = compute_n_replica({
      n: n_peer,
      ...this.options,
    });
    forward({
      k,
      kb,
      broadcast_one: this.broadcast_one[
        BroadcastType.broadcast_witness_testimony
      ],
      msg: args,
      src,
    });
  };

  request_next_block = async ({
    peer,
    connection,
    maddr,
    random_addr,
    block_hash,
  }: {
    peer?: PeerId;
    connection?: Libp2p.Connection;
    maddr?: string;
    random_addr?: boolean;
    block_hash?: IPFSAddress;
  }) => {
    const node = this.ctx.libp2p;
    if (random_addr) {
      const connections: Libp2p.Connection[] = [];
      for (const [key, value] of node.connectionManager.connections) {
        value
          .filter((c) => c.stat.status === 'open')
          .forEach((i) => connections.push(i));
      }
      if (!connections.length) {
        throw Error('no enough connections');
      }
      connection = connections[Math.floor(connections.length * Math.random())];
    } else if (!connection) {
      if (peer) {
        connection = await node.dial(peer);
      } else {
        connection = await node.dial(new Multiaddr(maddr));
      }
    }
    const { stream } = await connection.newStream(
      `/${PROTOCOL}/${protocols.consensus}/${protocol_version}`,
    );
    const msg_send = encode({
      reqType: ReqType.next_block,
      args: block_hash,
    });
    const [message] = await pipe([msg_send], stream, stream, toBuffer, collect);

    const msg_str = message.toString();
    // this.ctx.log(
    //   'request next:req ' + block_hash + ' res: ',
    //   msg_str.substr(0, 30) + '...',
    // );
    const res: ResRequestNextBlock = decode(msg_str);
    return res;
  };

  public async broadcast_actions_testimony(
    actions_testimony: ActionsTestimony,
    signature: Uint8Array,
  ) {
    const encoded_actions_testimony = encode({
      actions_testimony,
      signature,
    });
    const kb: IKBucket = get_kb(this.ctx);
    const n_peer = await this.ctx.db.peer.get_n_known_peers();
    broadcast_to_buckets({
      kb,
      msg: encoded_actions_testimony,
      k: compute_n_replica({
        n: n_peer,
        ...this.options,
      }),
      broadcast_one: this.broadcast_one[
        BroadcastType.broadcast_actions_testimony
      ],
    });
  }

  public async broadcast_witness_testimony(
    testimony_cid: IPFSAddress,
    signature: Uint8Array,
  ) {
    const msg = encode({
      testimony_cid,
      signature,
    });

    const kb: IKBucket = get_kb(this.ctx);
    const n_peer = await this.ctx.db.peer.get_n_known_peers();
    broadcast_to_buckets({
      kb,
      msg,
      k: compute_n_replica({
        n: n_peer,
        ...this.options,
      }),
      broadcast_one: this.broadcast_one[
        BroadcastType.broadcast_witness_testimony
      ],
    });
  }
}

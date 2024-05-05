import { Context } from '../../../shared/types';
import type { Multiaddr } from '@multiformats/multiaddr';
import { Connection, Stream } from '@libp2p/interface-connection';
import { PeerId } from '@libp2p/interface-peer-id';
import { IKBucket, KBucketContact, KBucketNode } from '../types';
import { array_equals, shuffle } from '../utils';

function get_bucket_node(kb: IKBucket, id: Uint8Array) {
  let bitIndex = 0;
  let node = kb.root;
  while (node.contacts === null) {
    node = kb._determineNode(node, id, bitIndex++);
  }
  return node;
}

export function get_common_bucket_node(
  kb: IKBucket,
  id_a: Uint8Array,
  id_b: Uint8Array,
) {
  let bitIndex = 0;
  let node = kb.root;
  while (true) {
    const a = kb._determineNode(node, id_a, bitIndex + 1);
    const b = kb._determineNode(node, id_b, bitIndex + 1);
    if (a !== b) {
      break;
    }
    if (!a) {
      break;
    }
    node = a;
  }
  return node;
}

export function broadcast_to_buckets<T>(options: {
  kb: IKBucket;
  msg: T;
  k: number; // per kucket
  send: (target_contact: KBucketContact, id: Uint8Array, msg: T) => void;
}) {
  const { kb, msg, k, send } = options;
  const broadcast_range = kb.root;

  for (const nodes = [broadcast_range]; nodes.length > 0; ) {
    const node = nodes.pop();
    if (node.contacts === null) {
      nodes.push(node.right, node.left);
    } else {
      const shuffled = shuffle([...node.contacts]);
      for (let i = 0; i < k; ++i) {
        const contact = shuffled.pop();
        if (!contact) {
          break;
        }
        send(contact, kb.localNodeId, msg);
      }
    }
  }
}

export function forward(options: {
  kb: IKBucket;
  send: (
    target_contact: KBucketContact,
    id: Uint8Array,
    msg: any,
  ) => Promise<void>;
  msg: any;
  src: Uint8Array;
  k: number;
}) {
  const { kb, send, msg, src, k } = options;
  const common_bucket = get_common_bucket_node(kb, src, kb.localNodeId);
  const src_bucket = get_bucket_node(kb, src);
  const candidates = [
    ...src_bucket.contacts.filter((i) => !array_equals(i.id, src)),
  ];
  const broadcast_range = common_bucket;
  for (const nodes = [broadcast_range]; nodes.length > 0; ) {
    const node = nodes.pop();
    if (node === src_bucket) {
      continue;
    }
    if (node.contacts === null) {
      nodes.push(node.right, node.left);
    } else {
      candidates.push(...node.contacts);
    }
  }
  const shuffled = shuffle(candidates);
  for (let i = 0; i < k; ++i) {
    const contact = shuffled.pop();
    if (!contact) {
      break;
    }
    send(contact, kb.localNodeId, msg);
  }
}

/**
 * 计算数据包需要广播的次数（不同目标）
 */
export function compute_n_replica(options: {
  n: number;
  success_rate: number; // （预计）单次传播的成功率
  up_rate: number; // （预计）在线率
  expected_success_rate: number; // 期望总成功率： 成功接收总数 / 在线节点总数
}) {
  return Math.ceil(
    Math.log(
      2 -
        2 *
          Math.pow(
            options.expected_success_rate,
            Math.log(2) / Math.log(options.n),
          ),
    ) /
      (options.up_rate * Math.log(1 - options.success_rate * options.up_rate)),
  );
}

export async function forceGetConnection(ctx: Context, target: PeerId) {
  const known_addrs = (await ctx.libp2p_node.peerStore.get(target)).addresses;
  const addrs: Multiaddr[] = [];
  if (known_addrs && known_addrs.length) {
    ctx.log('forceGetConnection', 'knownAddr');
    known_addrs.forEach((i) => addrs.push(i.multiaddr));
  } else {
    ctx.log('forceGetConnection', 'unknownAddr');
    const peer = await ctx.libp2p_node.peerRouting.findPeer(target);
    if (!peer) {
      ctx.log(
        'forceGetConnection',
        'failed: dht peer not found ' + target.toString(),
      );
    } else {
      ctx.log('forceGetConnection', 'found target', target.toString(), peer);
    }
  }
  let connection: Connection;
  for (const addr of addrs) {
    try {
      connection = await ctx.libp2p_node.dial(addr);
    } catch (e) {}
  }
  if (!connection) {
    ctx.log(
      'forceGetConnection',
      'failed: cannot dial target ' + target.toString(),
    );
    return;
  }
  return connection;
}

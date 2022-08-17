import { Context, BroadcastType, MID_B58 } from '../../shared/types';
import { IKBucket, KBucketContact, KBucketNode } from '../types';
import {
  array_equals,
  get_bucket_node,
  get_common_bucket_node,
  shuffle,
} from '../utils';

export function broadcast_to_buckets(options: {
  kb: IKBucket;
  msg: any;
  k: number; // per kucket
  broadcast_one: (
    target_contact: KBucketContact,
    id: Uint8Array,
    msg: any,
  ) => void;
}) {
  const { kb, msg, k, broadcast_one } = options;
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
        broadcast_one(contact, kb.localNodeId, msg);
      }
    }
  }
}

export function forward(options: {
  kb: IKBucket;
  broadcast_one: (
    target_contact: KBucketContact,
    id: Uint8Array,
    msg: any,
  ) => Promise<void>;
  msg: any;
  src: Uint8Array;
  k: number;
}) {
  const { kb, broadcast_one, msg, src, k } = options;
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
    broadcast_one(contact, kb.localNodeId, msg);
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

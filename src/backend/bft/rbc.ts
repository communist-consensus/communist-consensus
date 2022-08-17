import assert from "node:assert";
import EventEmitter from "node:events"

/**
 * 把消息 m 分成 N 份，任意 K 份可以恢复 m
 * 
 * 用这 N 份片段的哈希组成完全二叉树 MerkleTree
 * 
 * VAL:广播给其他节点
 * 
 * 当收到VAL
 *  验证 MerkleTree 合法性 // 可能每个节点不一致（比如选择性地广播）
 *  转发 ECHO
 * 
 * 当收到 ECHO
 *  验证 MerkleTree 合法性 // 可能每个节点不一致（比如控制了网络路由，选择性广播ECHO）
 *  如果当前 MerkleTree root 收到超过 N - f 个ECHO
 *    广播 READY
 *  如果收到该root 的超过2f+1个READY且 收到该root 的超过N-2*f个ECHO
 *    输出 m
 * 
 * 当收到 READY
 *  如果收到该root 的超过f+1个READY，转发
 *  如果收到该root 的超过2f+1个READY
 *    输出 m
 */
export class ReliableBroadcast extends EventEmitter {
  constructor(pid: number, N: number, f: number, leader: number, input: any) {
    super();
    assert(N >= 3 * f + 1);
    assert(f >= 0);
    assert(leader >= 0 && leader < N);
    assert(pid >= 0 && pid < N);
  }

  decode(K: number, N: number, stripes) {
    return stripes;
  }
  encode(K: number, N: number, m) {
    return m;
  }

  start() {
  }
}
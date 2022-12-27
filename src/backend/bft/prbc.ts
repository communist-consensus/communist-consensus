import assert from 'node:assert';
import EventEmitter from 'node:events';
import IPFS from '../ipfs';
import { InformerBody, SubProtocol } from '../types';
import { decode, encode, hash } from '../utils';
import { fec } from './fec';
import informer from './informer';
import { Context } from './types';

type PeerIndex = number;
enum PRBCMessageType {
  VAL,
  ECHO,
  READY,
}
type VALMessage = {
  type: PRBCMessageType.VAL;
  branch: string[];
  piece: Uint8Array;
  roothash: string;
};
type ECHOMessage = {
  type: PRBCMessageType.ECHO;
  sourceProvider: PeerIndex;
  pieceOwner: PeerIndex;
  branch: string[];
  piece: Uint8Array;
  roothash: string;
};
type READYMessage = {
  type: PRBCMessageType.READY;
  sourceProvider: PeerIndex,
  sourceProviderMsgCID: string;
};

type PRBCMessage = VALMessage | ECHOMessage | READYMessage;
/**
 * 单实例版PRBC(原版见末尾)
 * 
 * 每个Epoch中的每个节点创建1个prbc实例
 * 
 * 关于i的 PRBC 实例保证 i 的广播消息内容不被针对的前提下，收到至少 n-f 个对 msg_i 的预确认
 * 
 * 同时转发其他节点的 PRBC 消息直到epoch结束
 * 
 * (分片使消息msg_i难以被针对（优先级/传播成功率等等），在收到n-f个分片前无法得知消息内容。
 * 另外也避免了恶意节点广播大体积的虚假消息带来的带宽消耗。)
 *
 * (1)
 * 把消息 m 分成 N 份，任意 K 份可以恢复 m
 * 用这 N 份片段的哈希组成完全二叉树 MerkleTree
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
 *    还原 msg 并 发布到ipfs
 *    广播 READY(cid,sourceProvider,sign)
 *
 * (4)
 * 当收到 READY
 *  门限签名校验
 *  如果收到该root 的超过f+1个READY，进行签名并转发(至少有一个诚实节点主动发出了READY)
 *  如果收到该root 的超过2f+1个有效READY
 *    ipfs get(cid)，生成这个阶段的证明
 *    输出 m 和 证明
 * 
 * 附：原版PRBC
 * 每个epoch中每个节点创建N个PRBC实例，
 * 每个实例保证关于sender i 的广播消息内容不被针对的前提下，收到至少 n-f 个对 msg_i 的预确认
 * 
 * 原版PRBC在READY时进行阈值解密，而我们在收到足够ECHO时进行
 * 
 */
export class ProvableReliableBroadcast {
  input: any;
  EchoThreshold: number;
  ReadyThreshold: number;
  OutputThreshold: number;
  ResolveThreshold: number;

  ipfs: IPFS;
  K: number;

  ctx: Context;

  outputCIDs: Map<PeerIndex, string> = new Map();
  outputSignatures: Map<PeerIndex, Map<PeerIndex, Uint8Array>> = new Map();

  readyReceived: Map<PeerIndex, Set<PeerIndex>> = new Map();
  outputs: Map<PeerIndex, Uint8Array>;
  receivedPieces = new Map<PeerIndex, Map<PeerIndex, Uint8Array>>();
  receivedRoothashes = new Map<PeerIndex, Map<string, Set<PeerIndex>>>();
  mtreeRoots = new Map<PeerIndex, string>();
  encoder: {
    encode: (src: any) => Uint8Array[];
    decode: (input_array: any) => Uint8Array;
    k: any;
    n: any;
    enc_matrix: Uint8Array;
    stride: number;
  };

  readyHasSent = new Set<PeerIndex>();
  readySignatures: Map<
    PeerIndex,
    Map<string, Map<PeerIndex, Uint8Array>>
  > = new Map();

  resolved = false;
  resolve: (data: {
    outputs: Map<PeerIndex, Uint8Array>;
    quorumCertification: {
      cids: Map<PeerIndex, string>;
      signatures: Map<PeerIndex, Map<string, Map<PeerIndex, Uint8Array>>>;
    };
  }) => void;

  constructor({
    ctx,
    input,
    ipfs,
    outputs,
  }: {
    ctx: Context;
    input: any;
    ipfs: IPFS;
    outputs: Map<PeerIndex, Uint8Array>;
  }) {
    this.outputs = outputs;
    const { N, f, pid } = ctx;
    this.ctx = ctx;
    assert(N >= 3 * f + 1);
    assert(f >= 0);
    assert(pid >= 0 && pid < N);

    this.ipfs = ipfs;
    this.K = N - 2 * f; // Need this many to reconstruct. (# noqa: E221)
    this.EchoThreshold = N - f; // Wait for this many ECHO to send READY. (# noqa: E221)
    this.ReadyThreshold = f + 1; // Wait for this many READY to amplify READY. (# noqa: E221)
    this.OutputThreshold = N - f; // Wait for this many READY to output
    // NOTE: The above thresholds  are chosen to minimize the size
    // of the erasure coding stripes, i.e. to maximize K.
    // The following alternative thresholds are more canonical
    // (e.g., in Bracha '86) and require larger stripes, but must wait
    // for fewer nodes to respond
    //   EchoThreshold = ceil((N + f + 1.)/2)
    //   K = EchoThreshold - f

    this.ResolveThreshold = N - f;

    this.input = input;
    this.encoder = fec(N - f, N);
  }

  /**
   * root is tree[1]
   * @param data
   * @returns
   */
  merkleTree(data: any[]) {
    const n = data.length;
    const n_leaves = Math.pow(2, Math.ceil(Math.log(n)));
    const tree = new Array(n_leaves * 2).fill(0).map((i) => '');
    for (const i in data) {
      tree[n_leaves + i] = hash(data[i]);
    }
    for (let i = n_leaves - 1; i > 0; --i) {
      tree[i] = hash(tree[i * 2] + tree[i * 2 + 1]);
    }
    return tree;
  }

  getMerkleBranch(index: number, tree: string[]) {
    const res: string[] = [];
    let t = index + (tree.length >> 1);
    while (t > 1) {
      // 在到root的路径上取相邻的节点
      res.push(tree[t ^ 1]);
      t = t >> 1;
    }
    return res;
  }

  merkleVerify(val, roothash: string, branch: string[], index: number) {
    let tmp = hash(val);
    let tindex = index;
    for (const br of branch) {
      // 合并相邻节点计算摘要
      tmp = hash((tindex & 1 && br + tmp) || tmp + br);
      tindex = tindex >> 1;
    }
    if (tmp != roothash) return false;
    return true;
  }

  verifyPRBCMessage(sender: PeerIndex, data: PRBCMessage) {
    assert(
      data &&
        (data.type === PRBCMessageType.ECHO ||
          data.type === PRBCMessageType.VAL ||
          data.type === PRBCMessageType.READY),
    );
    if (data.type === PRBCMessageType.VAL) {
      assert(
        data.piece instanceof Uint8Array &&
          typeof data.roothash === 'string' &&
          data.branch instanceof Array &&
          data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
          this.merkleVerify(
            data.piece,
            data.roothash,
            data.branch,
            this.ctx.pid,
          ),
      );
    } else if (data.type === PRBCMessageType.ECHO) {
      assert(
        Number.isInteger(data.pieceOwner) &&
          data.pieceOwner < this.ctx.N &&
          data.pieceOwner >= 0 &&
          Number.isInteger(data.sourceProvider) &&
          data.sourceProvider < this.ctx.N &&
          data.sourceProvider >= 0 &&
          data.piece instanceof Uint8Array &&
          typeof data.roothash === 'string' &&
          data.branch instanceof Array &&
          data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
          this.merkleVerify(
            data.piece,
            data.roothash,
            data.branch,
            data.pieceOwner,
          ),
      );
    } else if (data.type === PRBCMessageType.READY) {
      assert(
        typeof data.sourceProviderMsgCID === 'string' &&
          Number.isInteger(data.sourceProvider) &&
          data.sourceProvider < this.ctx.N &&
          data.sourceProvider >= 0,
      );
    }
  }

  async onMessage(sender: PeerIndex, informer_body: InformerBody) {
    const data = decode<PRBCMessage>(informer_body.data);
    const signature = informer_body.signature;
    this.verifyPRBCMessage(sender, data);
    if (data.type === PRBCMessageType.VAL) {
      if (this.mtreeRoots.get(sender)) return;
      this.mtreeRoots.set(sender, data.roothash);
      this.broadcast({
        type: PRBCMessageType.ECHO,
        sourceProvider: sender,
        pieceOwner: this.ctx.pid,
        branch: data.branch,
        roothash: data.roothash,
        piece: data.piece,
      });
    } else if (data.type === PRBCMessageType.ECHO) {
      const { sourceProvider, pieceOwner, piece, roothash } = data;
      if (this.receivedPieces.get(sourceProvider).get(pieceOwner)) return;
      this.receivedPieces.get(sourceProvider).set(pieceOwner, piece);
      if (!this.receivedRoothashes.get(sourceProvider).get(roothash)) {
        this.receivedRoothashes.get(sourceProvider).set(roothash, new Set());
      }
      this.receivedRoothashes.get(sourceProvider).get(roothash).add(pieceOwner);
      if (
        this.receivedRoothashes.get(sourceProvider).get(roothash).size <
        this.EchoThreshold
      )
        return;
      if (this.readyHasSent.has(sourceProvider)) return;
      this.readyHasSent.add(sourceProvider);

      const sourceProviderMsg = this.encoder.decode(
        this.receivedPieces.get(sourceProvider).values(),
      );
      const sourceProviderMsgCID = await this.ipfs.add(sourceProviderMsg);
      this.broadcast({
        type: PRBCMessageType.READY,
        sourceProviderMsgCID,
        sourceProvider,
      });
    } else if (data.type === PRBCMessageType.READY) {
      const { sourceProvider, sourceProviderMsgCID } = data;
      if (this.readyReceived.get(sourceProvider).has(sender)) return;
      this.readyReceived.get(sourceProvider).add(sender);

      if (!this.readySignatures.get(sourceProvider).get(sourceProviderMsgCID)) {
        this.readySignatures
          .get(sourceProvider)
          .set(sourceProviderMsgCID, new Map());
      }
      this.readySignatures
        .get(sourceProvider)
        .get(sourceProviderMsgCID)
        .set(sender, signature);

      const nVote = this.readySignatures
        .get(sourceProvider)
        .get(sourceProviderMsgCID).size;

      // Amplify ready messages
      if (nVote >= this.ReadyThreshold) {
        this.broadcast(data);
      }

      if (nVote < this.OutputThreshold) return;
      if (this.outputCIDs.get(sourceProvider)) return;
      this.outputCIDs.set(sourceProvider, sourceProviderMsgCID);
      this.outputs.set(
        sourceProvider,
        await this.ipfs.get(sourceProviderMsgCID),
      );

      if (this.outputs.size < this.ResolveThreshold) return;
      if (this.resolved) return;
      this.resolved = true;

      this.resolve({
        outputs: this.outputs,
        quorumCertification: {
          cids: this.outputCIDs,
          signatures: this.readySignatures,
        },
      });
    }
  }

  broadcast(msg: ECHOMessage | READYMessage) {}

  sendVal(target: number, msg: VALMessage) {
    // TODO
  }

  async start() {
    const pieces = this.encoder.encode(new Uint8Array(this.input));
    const mtree = this.merkleTree(pieces);
    const roothash = mtree[1];
    for (let i = 0; i < this.ctx.N; ++i) {
      this.receivedPieces.set(i, new Map());
      this.receivedRoothashes.set(i, new Map());
      this.readySignatures.set(i, new Map());
      this.readyReceived.set(i, new Set());
    }
    for (let i = 0; i < this.ctx.N; ++i) {
      if (i === this.ctx.pid) continue;
      const branch = this.getMerkleBranch(i, mtree);
      this.sendVal(i, {
        type: PRBCMessageType.VAL,
        branch,
        roothash,
        piece: pieces[i],
      });
    }
    informer.addListener(SubProtocol.PRBC, this.onMessage);
  }
}

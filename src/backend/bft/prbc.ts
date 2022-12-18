import assert from 'node:assert';
import EventEmitter from 'node:events';
import IPFS from '../ipfs';
import { InformerBody, SubProtocol } from '../types';
import { decode, encode, hash } from '../utils';
import { fec } from './fec';
import informer from './informer';

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
  pieceProvider: PeerIndex;
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
 * 每个Epoch中的每个节点创建1个prbc实例
 * 
 * 关于i的 PRBC 实例保证 i 的广播消息内容不被针对的前提下，收到至少 n-f 个对 msg_i 的预确认
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
 */
export class ProvableReliableBroadcast {
  N: number;
  K: number;
  selfIdx: number;
  f: number;
  input: any;
  EchoThreshold: number;
  ReadyThreshold: number;
  OutputThreshold: number;
  ExitThreshold: number;

  ipfs: IPFS;

  outputCIDs: Map<PeerIndex, string> = new Map();
  outputSignatures: Map<PeerIndex, Map<PeerIndex, Uint8Array>> = new Map();

  outputs = new Map<PeerIndex, Uint8Array>();
  sourceToPieces = new Map<PeerIndex, Map<PeerIndex, Uint8Array>>();
  mtreeRoots = new Map<PeerIndex, string>();
  encoder: {
    encode: (src: any) => Uint8Array[];
    decode: (input_array: any) => Uint8Array;
    k: any;
    n: any;
    enc_matrix: Uint8Array;
    stride: number;
  };

  // map<source, set<sender>>
  sourceToReadySender = new Map<PeerIndex, Set<PeerIndex>>();
  readySignatures: Map<
    PeerIndex,
    Map<string, Map<PeerIndex, Uint8Array>>
  > = new Map();

  resolveFn: (data: {
    outputs: Map<PeerIndex, Uint8Array>;
    quorumCertification: {
      cids: Map<PeerIndex, string>;
      signatures: Map<PeerIndex, Map<string, Map<PeerIndex, Uint8Array>>>;
    };
  }) => void;

  constructor({
    selfIdx,
    N,
    f,
    input,
    ipfs,
  }: {
    selfIdx: number;
    N: number;
    f: number;
    input: any;
    ipfs: IPFS;
  }) {
    assert(N >= 3 * f + 1);
    assert(f >= 0);
    assert(selfIdx >= 0 && selfIdx < N);

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
    this.ExitThreshold = N - f; // Wait for this many READY to output

    this.N = N;
    this.f = f;
    this.input = input;
    this.selfIdx = selfIdx;
    this.encoder = fec(this.N - this.f, this.N);
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
          this.merkleVerify(data.piece, data.roothash, data.branch, sender),
      );
    } else if (data.type === PRBCMessageType.ECHO) {
      assert(
        Number.isInteger(data.pieceProvider) &&
          data.pieceProvider < this.N &&
          data.pieceProvider >= 0 &&
          Number.isInteger(data.sourceProvider) &&
          data.sourceProvider < this.N &&
          data.sourceProvider >= 0 &&
          data.piece instanceof Uint8Array &&
          typeof data.roothash === 'string' &&
          data.branch instanceof Array &&
          data.branch.reduce((m, i) => m && typeof i === 'string', true) &&
          this.merkleVerify(
            data.piece,
            data.roothash,
            data.branch,
            data.pieceProvider,
          ),
      );
    } else if (data.type === PRBCMessageType.READY) {
      assert(
        typeof data.sourceProviderMsgCID === 'string' &&
          Number.isInteger(data.sourceProvider) &&
          data.sourceProvider < this.N &&
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
        pieceProvider: sender,
        branch: data.branch,
        roothash: data.roothash,
        piece: data.piece,
      });
    } else if (data.type === PRBCMessageType.ECHO) {
      const { sourceProvider, pieceProvider, piece } = data;
      if (this.sourceToPieces.get(sourceProvider).get(pieceProvider)) return;
      this.sourceToPieces.get(sourceProvider).set(pieceProvider, piece);
      this.broadcast(data);
      if (
        this.sourceToPieces.get(data.sourceProvider).size >= this.EchoThreshold
      ) {
        const { sourceProvider } = data;
        if (this.sourceToReadySender.get(sourceProvider).has(sender)) return;
        this.sourceToReadySender.get(sourceProvider).add(sender);
        const sourceProviderMsg = this.encoder.decode(
          this.sourceToPieces.get(sourceProvider).values(),
        );
        const sourceProviderMsgCID = await this.ipfs.add(sourceProviderMsg);
        this.broadcast({
          type: PRBCMessageType.READY,
          sourceProviderMsgCID,
          sourceProvider,
        });
      }
    } else if (data.type === PRBCMessageType.READY) {
      const { sourceProvider, sourceProviderMsgCID } = data;
      if (this.sourceToReadySender.get(sourceProvider).has(sender)) return;
      this.sourceToReadySender.get(sourceProvider).add(sender);

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

      if (nVote >= this.OutputThreshold) {
        if (!this.outputCIDs.get(sourceProvider)) {
          this.outputCIDs.set(sourceProvider, sourceProviderMsgCID);
          this.outputs.set(
            sourceProvider,
            await this.ipfs.get(sourceProviderMsgCID),
          );
          if (this.outputs.size >= this.ExitThreshold) {
            informer.removeListener(SubProtocol.PRBC, this.onMessage);

            for (let i = 0; i < this.N; ++i) {
              if (!this.outputs.get(i)) {
                this.readySignatures.get(i).clear();
              }
            }
            this.resolveFn({
              outputs: this.outputs,
              quorumCertification: {
                cids: this.outputCIDs,
                signatures: this.readySignatures,
              },
            });
          }
        }
      }
    }
  }

  broadcast(msg: ECHOMessage | READYMessage) {
    // TODO
  }

  send(target: number, msg: VALMessage) {
    // TODO
  }

  async start() {
    const pieces = this.encoder.encode(new Uint8Array(this.input));
    const mtree = this.merkleTree(pieces);
    const roothash = mtree[1];
    for (let i = 0; i < this.N; ++i) {
      this.sourceToPieces.set(i, new Map());
      this.sourceToReadySender.set(i, new Set());
      this.readySignatures.set(i, new Map());
    }
    for (let i = 0; i < this.N; ++i) {
      if (i === this.selfIdx) continue;
      const branch = this.getMerkleBranch(i, mtree);
      this.send(i, {
        type: PRBCMessageType.VAL,
        branch,
        roothash,
        piece: pieces[i],
      });
    }
    informer.addListener(SubProtocol.PRBC, this.onMessage);
    return await new Promise<{
      outputs: Map<PeerIndex, Uint8Array>;
      quorumCertification: {
        cids: Map<PeerIndex, string>;
        signatures: Map<PeerIndex, Map<string, Map<PeerIndex, Uint8Array>>>;
      };
    }>((resolve) => {
      this.resolveFn = resolve;
    });
  }
}

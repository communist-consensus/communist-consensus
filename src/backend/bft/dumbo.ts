import IPFS from "../ipfs";
import { ProvableReliableBroadcast } from "./prbc";
import { Context } from "./types";

/**
 * （为了口语化，以下使用的“别人”指“多数人”，"多数"/"大部分"不是指超过50%而是指超过阈值，拜占庭协议中阈值一般为2/3）
 * 阶段：
 * 1）互相发送消息。我知道别人发的消息，别人知道我发的消息。
 * 实现：广播+数字签名
 * 2）我知道别人（不）知道，别人知道我（不）知道
 * 实现：n个PRBC实例
 * 3）我知道"别人知道我（不）知道"，别人知道"我知道别人（不）知道"
 * 实现：交换阶段（2）的证明
 * 4）我知道"大部分人中每个人知道的消息组合"(且被多数人确认的），别人知道"我知道的消息组合"
 * 实现：
 * 5）经过协商，共同确定一个最终状态，使每个人（多数人）确认的消息组合是一致的
 * 
 * 阶段n的完成至少需要多数人完成n-1阶段
 * 
 * 设有四个节点A,B,C,D，其中a1表示A在阶段1发送的消息
 * 第一阶段接收情况：
 * A:a1,b1,c1
 * B:b1,c1,d1
 * C:a1,c1,d1
 * D:a1,b1,d1
 * 
 * 第二阶段接收情况：
 * A:a2,b2,c2
 * B:b2,c2,d2
 * C:a2,c2,d2
 * D:a2,b2,d2
 * 
 * 第三阶段接收情况：
 * A:a3,b3
 * B:b3,c3,d3
 * C:a3,c3,d3
 * D:a3,b3,d3
 * 
 * B,C,D虽然都完成了第三阶段，但他们接收的消息组合是不同的(异步网络下每个节点只能获取网络中产生的部分信息)
 * 
 * 第四阶段接收情况：
 * 
 * 
 * 
 * 实现：
 * 阶段：
 * 1）各自发送广播消息，消息接收方收到广播消息时返回签名确认消息
 * 2）将第一阶段的所有消息打包并广播，接收方收到第二阶段的广播消息时返回签名确认消息
 * 3）将第二阶段的所有消息打包并广播，接收方收到第三阶段的广播消息时返回签名确认消息
 * 4）
 * 
 * 
 * 0) 节点互相发送广播
 * 1) 节点互相交换证明a，证明自己的消息被至少N-f个节点收到
 * 2) 当收到N-f个证明a，把这些证明a打包成证明b并广播
 * 3) 节点互相交换证明c，证明自己的证明b被至少N-f个节点收到。每收到一个证明c，把对应的节点idx记录到 is_cbc_delivered
 * 4) 当收到N-f个证明c
 * 5) 节点互相交换is_cbc_delivered，当收自己的is_cbc_delivered到N-f个证人签名时，把它们打包为证明d
 * 6) 节点互相交换证明d
 * 7) 当收到N-f个证明d时，记录他们对应的节点idx到 is_commit_delivered
 * 8) 抛硬币取随机数并以这个随机数为种子随机选择一个节点a。
 * 9) 如果is_cbc_delivered[a]，为 a 投Yes票，否则投No。
 * 如果a的票数
 * 
 * 1. 节点i使用 ProvableReliableBroadcast 协议发送 msg[i]
 * 2. 关于接收节点x，发送节点 i 的 PRBC 协议保证 x 收到至少 n-f 个对 msg[i] 的预确认，并生成证明
 * [完成 阶段一阶段二][我知道别人（不）知道]
 * 3. validatedCommonSubset/VACS，每个节点一个vacs实例，与prbc并发，输入为prbc_proofs[self_idx] 包含 [prbc_sid, root_hash, sigma]
 *   3.1 广播VACS的input
 *   3.2 如果收到N-f个VACS广播 
 * [完成 阶段三][我知道“别人知道我（不）知道”]
 *   3.3 执行validatedAgreement/VABA，输入为N-f个vacs广播消息
 *     3.3.1 consistentBroadcast，N个实例并发，输入为vaba的输入
 *        每个实例保证输入被N-f个节点接收，且N-f个节点对输入进行了确认
 * 
 *        (如果是self_idx)广播input ， 转发(如果 sid 相同)
 *        如果收到 N-f 个相同sid的广播，广播 cbc final 包含(input, N-f个签名)
 *        监听 cbc final消息(不依赖前步骤），如果有效，中断当前cbc返回 m, sigmas
 *     3.3.2 当N-f个节点完成了3.3.1，记录他们的idx到 is_cbc_delivered map
 *     3.3.3 并行执行N个consistentBroadcast-Commit，输入为 copy(is_cbc_delivered)
 *     3.3.4 当收到 N-f个有效cbc final，记录他们的idx到 is_commit_delivered map，[完成 阶段四][我知道“别人知道的消息组合”]
 *     3.3.5 coin-permutation
 * 抛硬币取随机数，再取随机节点
 * 如果这个节点在自己的消息组合中，广播1，否则广播0
 * 直到票数大于N-f，如果票数中存在一个1且自己的消息组合中不包含它，修改自己的投票并等待同步。表示至少有一个诚实节点的消息组合中包含它
 * 
 * 抛硬币取随机布尔值种子
 * 将投票作为aba输入，循环aba直到aba返回common coin
 * 根据aba的结果决定是否采用这个随机节点的消息组合作为区块输入
 */
export async function start({
  sid,
  pid,
  B,
  N,
  f,
  sPk,
  sSK,
  sPk1,
  sSK1,
  sPk2,
  sSK2,
  ePk,
  eSK,
}: Context) {
  let r = 0;

  const vacs_recv = [];
  const tpke_recv = [];
  const prbs_recvs = new Array(N).fill(0).map(i => []);

  const my_prbc_input = [];

  const prbs_outputs = new Array(N).fill(0).map(i => []);
  const prbc_proofs = {};

  const vacs_input = [];
  const vacs_output = [];

  const input = 'test';
  const ipfs = await IPFS.create();
  const selfIdx = pid;
  const { outputs, quorumCertification } = await (
    new ProvableReliableBroadcast({
      selfIdx,
      N,
      f,
      input,
      ipfs,
    })
  ).start();

  await(
    new ValidatedCommonSubset({
      sid,
      pid,
      N,
      f,
      PK,
      SK,
      PK1,
      SK1,
      PK2s,
      SK2,
      input,
    }),
  ).start();
  await (new DumboCommonSubset()).start();
}
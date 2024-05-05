## Mass Consensus 共识协议

实现目标：
- 技术实现上保证无差别的直接民主，使参与者在共识网络中的权力相等，并且保证可靠性和安全性
    - 协议具有一定的抗干扰和抗攻击能力，可容忍一部分恶意参与者
    - 协议允许一部分的参与者离线，并且可以上线后恢复共识数据
- 数字身份与现实身份的绑定+隐私保护
    - 保证参与者在民主决策中一人一票
    - 参与者之间可互相检验真伪，并且不泄漏隐私信息
- 信息存储与计算的公平
    - 为了保证数据的一致性以及数据处理（如投票统计）的正确性，计算节点和存储节点都需要去中心化，每位参与者都可参与计算和存储
- 信息传输的公平
    - 为了保证信息传输不会被恶意干扰（发送大量无效信息消耗资源，或者对正常信息限速、推迟或者丢弃），需要实现路由的去中心化，节点之间使用动态路由建立点对点连接

Mass Consensus 议题管理规范：
- 议题的基本属性
- 议题的分类机制
- 议题的生命周期
- 投票机制
- 议题的执行器/智能合约

### 共识的结果

共识的结果是一组操作记录，即每位遵循协议的参与者存储（和处理）的所有参与者的操作记录是一致的，其中操作记录包括：
- 发起新的议题
- 对议题投票，评论等

这组操作记录的证明由多数参与者的数字签名组成。

在议题的解决方案中可设置智能合约，它在议题达成共识后触发，智能合约的功能包括不限于：
- 管理参与者的加入和退出
- 修改共识协议实现的代码
    - 扩展更多类型的智能合约
    - 修改共识协议本身

共识的结果也可以通过智能合约修改代码进行扩展。

## 学术风格的描述

这是一个支持动态节点的异步拜占庭容错的共识协议；这是一个支持动态节点的异步拜占庭容错的强一致性写入读取最终一致性读取的分布式协议；这是一个无代币的 Proof of Authority/People 的类区块链协议；

其中动态节点意味着共识的参与者名单是动态的，在每一轮决策后可能产生新的参与者或者让曾经的参与者退出；节点的网络地址可能发生变化，路由表信息是动态的。
异步即异步网络，在异步网络中的消息的不保证在有限的时间内到达，互联网是典型的异步网络。
拜占庭容错，可容忍一定比例的恶意参与者，恶意参与者可以不遵循共识协议，干扰其他正常参与者。

# Mass Consensus

A decentralized decision-making protocol.

NOTE: This implementation is unstable and may contain security issues.

Mass Consensus decentralized decision-making protocol is based on public accessible permissioned blockchain (Proof of Authority) powered by Libp2p, Asynchronous Byzantine Fault Tolerance and IPFS.

## Preview
![image (1)](https://user-images.githubusercontent.com/11901882/185803003-dae1640c-ddd4-444d-a21e-21fd519ebba9.png)
![1](https://user-images.githubusercontent.com/11901882/186810873-29faee9c-055b-45a4-96bd-a4e0afc15f70.jpg)
![2](https://user-images.githubusercontent.com/11901882/186810883-99fb0480-04bc-4948-a5cd-5b0b0087e1f3.jpg)

![image (6)](https://user-images.githubusercontent.com/11901882/185803045-fa270b3a-6c76-4298-93cc-e57ee8cb1263.png)
![image (3)](https://user-images.githubusercontent.com/11901882/185803028-a2f9cd3e-e57a-4a58-a47c-1d8c1b31834f.png)


## Design goals

### Completely Decentralized

* Not dependent on specific hardware and operating system
* Not dependent on specific ISP, DNS, IP addresses
* Not dependent on existing public blockchain
* No temporary or logic leader / committee during consensus process to achieve liveness and avoid biases on critical decisions
* Nodes have equal weights

### Scalibility

* Protocols support self-upgrade by decision-making process (human in the loop)
* Dynamic total nodes n after each epoch

### Threat model
* Completely asynchronous network, meaning that no assumptions are made regarding the delivery schedule of messages by the network.
* Nodes have bounded memory
* Static corruptions
* The adversary can selectively delay, refuse messages and selectively mislead others. But they cannot forge signatures, generate message for a specific hash.
* The network will not drop any values from honest nodes.
* At most 1 / 3 byzantine nodes

## Implementation

Waterbear-QS-Q (using AVID and Quadratic-RABA)

ABA + common coin
RABA + common coin
ABA + local coin
RABA + local coin

DYX+ ADKG relies on
    Decisional Composite Residuosity assumption (expensive to instantiate)
    Decisional Diffie-Hellman assumption, incurring a high latency (more than 100s with a failure threshold of 16).
    random oracle model (ROM) which takes hash function as an ideal function;
    public key infrastructure (PKI) to support the trustworthiness of public keys

threshold signature
Boldyreva(pairing based)
pairing-free threshold PRF scheme of Cachin, Kursawe, and Shoup

aba
  pace
  honeybadger
  beat
  epic
  DispersedLedger
mvba
  dumboNG
  s-dumbo
  dory
dag
  tusk
  Bullshark

bkr
    hbbft
    beat
    epic
ckps
    sintra
    dumbo
cnv
    ritas
dkss
    tusk
dz
    pace

| name | async | dynmaic nodes | no leader election or trust setup | adaptive security |
| --- | --- | --- | --- | --- |
| PBFT | 0 | 0 | 1 | 0 |
| HotStuff | 0 | 0 | 1 | 0 |
| Zzyzx | 0 | 0 | 1 | 0 |
| DAG-Rider | 1 | 0 | 0 | 0 |
| Tusk| 1 | 0 | 0 | 0 |
| Bullshark| 1 | 0 | 0 | 0 |
| SodsBC| 1 | 0 | 0 | 0 |
| PACE| 1 | 0 | 0 | 0 |
| RITAS| 1 | 0 | 0 | 1 |
| BEAT | 1 | 0 | 0 | 0 |
| WaterBear family | 1 | 0 | 1 | 1 |
| HoneyBadger | 1 | 1 | 0 | 0 |
| Dumbo family | 1 | 0 | 0 | 0 |
| Dory | 1 | 0 | 0 |  |
| Dyno |1 | 1 | 0 | 1 |
| FIN| 1 |? | 0 | ? |
| EPIC | 1 | 0 | 1 | 1 |
| Mass Consensus BFT | 1 | 1 | 1 | 1 |

各种 BFT 方案的对比


## Papers

Alea-BFT
HoneyBadger BFT
Practical Asynchronous Distributed Key Generation
Efficient Asynchronous Byzantine Agreement without Private Setups
Dumbo
Dumbo-MVBA
An Introduction to Asynchronous Binary Byzantine Consenus
Complexity of Multi-Value Byzantine Agreement
Aggregatable Distributed Key Generation
Dumbo NG
Speeding Dumbo

information-theoretic security
quantum security，
computational security，例如非对称加密

PBFT: quantum security, partially synchronous BFT

liveness: 
static security: 攻击者在协议开始时就选择要攻击的对象
adaptive security:

weak common coin: 1/d的概率所有节点同时输出0或1,d>2
perfect common coin: 1/2的概率所有节点同时输出0或1

## 议题管理规范
![image](https://user-images.githubusercontent.com/11901882/185021696-b48ccff1-3b28-48cc-ac47-2377bf8e7476.png)

议题的生命周期分为四个阶段：发起议题或参与议题，（子）会议内讨论与投票，公示阶段，执行阶段。在发起议题后，议题进入所属议题域的等待队列中。议题按照不同领域分类，每个议题域中参与者最多的议题将被激活进入会议流程。议题域的变更由相应议题和相应的智能合约实现。

参与者可以在公示以前参与议题。参与议题时需要提供期望的会议时间窗口、期望公示时间窗口，通过这些期望时间的平均值得出截止时间。另外还需要提供期望子会议容量，会议人数如果超过平均期望会议容量，将拆分为若干个子会议。这些子会议中在选出胜出的方案后进入新的一轮讨论与投票，如果候选方案胜出者仍然超过平均期望会议容量，将再次拆分，如此反复直到选出最终方案。

在（子）会议截止前，投票人可对多个方案进行投票，票数最多的方案胜出。最后一轮投票胜出的方案在公示期后由智能合约执行。

为防止具有破坏性的议题的执行，采用以下策略：

（1） 最小公示期与最终方案支持者人数占总人数的比例成反比，以此增加领域专家参与会议的概率。

（2） 参与者可以对可疑人员提出质疑，如果议题通过，可疑人员将从组织中移除。

（3） 冷静机制：参与者可以在公示期冻结议题，同时该参与者也进入冻结状态。等待其他参与者的评估，解除冻结或取消议题。

在一些无法直接应用智能合约的场景，仍然需要选举出执行代表，选举过程与提案过程相同。并应遵循此原则：任何过程尽可能使用民主决策，如果暂时无法实现，必须给出具体条件，当满足条件的时候立即转换为民主决策（此规则也可使用智能合约编写）。

## TODO

* TLA+ liveness proof and safety proof
* TLPS correctness proof

AVID(asynchronous verifiable information dispersal protocol) 一种信息分散协议,其目的是通过编码和冗余来提高容错性,允许从部分节点恢复原始信息。
RBC(Reliable Broadcast) 拜占庭容错的可靠广播协议。

| AVID scheme | dispersal phase cost | retrieval phase cost |
|---|---|---|
| Cachin and Tessaro | 𝑂(𝑛\|𝑀\|+𝜅𝑛^2 log 𝑛) |  𝑂(\|𝑀\|+𝜅𝑛 log 𝑛) |
| Alhaddad and Yang | 𝑂(\|𝑀\|+𝜅𝑛^2)  | 𝑂(\|𝑀\|+𝜅𝑛 log 𝑛)|

* FLP不可能
异步拜占庭协议不可能在确定的步数后达成共识，为了达成共识，需要使用公共随机数以一定概率逼近共识，在不确定的步数后达成共识

# 协议概览

1. 互相广播proposal，直到多数节点的proposal被确认接收

2. 确定公共子集
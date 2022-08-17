# Communist Consensus decentralized decision-making automation
# Communist Consensus 去中心化决策系统

NOTE: This implementation is unstable and may contain security issues.

Communist Consensus decentralized decision-making automation is an cross-platform application based on public accessible permissioned blockchain (Proof of Authority) powered by Libp2p, Asynchronous BFT (Dumbo-BFT), Practical Asynchronous Distributed Key Generation and IPFS.

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
* No temporary leader / committee during consensus process to avoid biases on critical decisions
* Nodes have equal weights

### Scalibility

* Upgrade itself(anything) by decision-making process
* Dynamic nodes

## Security and performance

### Threat model
* Asynchronous network, meaning that no assumptions are made regarding the delivery schedule of messages by the network.
* Nodes have bounded memory
* The adversary can selectively delay, refuse messages and selectively mislead others. But they cannot forge signatures, generate message for a specific hash.
* The network will not drop any values from honest nodes.

### Performance

* 容忍至多 1 / 3 静态恶意节点
* 区块的生成最少需要 2 / 3 节点同时在线
* Cryptographic Assumption:DDH/DCR/SXDH
* Setup Assumption: RO/CRS/PKI
eventual synchrony
* Distributed Key Generation 通信复杂度和计算复杂度取决于 ADKG
* 共识复杂度取决于 ABFT

|DKG|网络模型|Field Element|High Threshold|通信复杂度（每个节点）|计算复杂度|轮数|密码学假设|Setup Assumption|leaderless|确定性|容错|
|---|---|---|---|---|---|---|---|---|---|---|---|
|Kate|partial sync|y|n|O(kn^3)|O(n^3)|O(n)|DDH|RO&PKI|n||1/3|
|Kokoris|async|y|y|O(kn^3)|O(n^3)|O(n)|DDH|RO|y||1/3|
|Abraham|async|n|n|O(kn^2)|O(n^2)|O(1)|SXDH|RO&PKI||n|1/3，假设敌手不进行选择性欺骗分割网络|
|Practical ADKG|async|y|y|O(kn^2)|O(n^3)|O(logn)|DDH|RO&PKI|y|y|1/3|

多种 DKG 方案的对比

|ABFT|Strong Validity|Memory-bounded implementation|通信复杂度|
|---|---|---|---|
|DAG-Rider|Y|?|O(\|𝐵\|𝑛^2 +𝜆𝑛^3 log𝑛)|
|DispersedLedger|Y|?|O(\|𝐵\|𝑛^2 +𝜆𝑛^3 log𝑛)|
|Alegh|Y|?|O(\|𝐵\|𝑛^2 +𝜆𝑛^3 log𝑛)|
|Tusk|N|Y|O(\|𝐵\|𝑛^2 +𝜆𝑛^3 log𝑛)|
|HBBFT|Y|Y|O(\|𝐵\|𝑛^2 +𝜆𝑛^3 log𝑛)|
|Dumbo|Y|Y|O(\|𝐵\|𝑛^2 +𝜆𝑛^3 log𝑛)|

多种 Asynchronous BFT 方案的对比

我们使用 Practical ADKG 与 DumboBFT 以满足我们的设计目标。

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

## 民主决策过程
![image](https://user-images.githubusercontent.com/11901882/185021696-b48ccff1-3b28-48cc-ac47-2377bf8e7476.png)

关于议题的产生与执行如图所示。议题的生命周期分为四个阶段：发起议题或参与议题，（子）会议内讨论与投票，公示阶段，执行阶段。在发起议题后，议题进入所属议题域的等待队列中。议题按照不同领域分类，每个议题域中参与者最多的议题将被激活进入会议流程。议题域的变更由相应议题和相应的智能合约实现。

成员可以在公示以前任何阶段参与议题。参与议题时需要提供期望的会议时间窗口、期望公示时间窗口，通过这些期望时间的平均值得出截止时间。另外还需要提供期望子会议容量，会议人数如果超过平均期望会议容量，将拆分为若干个子会议。这些子会议中在选出胜出的方案后进入新的一轮讨论与投票，如果候选方案胜出者仍然超过平均期望会议容量，将再次拆分，如此反复直到选出最终方案。

在（子）会议截止前，投票人可对多个方案进行投票，票数最多的方案胜出。最后一轮投票胜出的方案在公示期后由智能合约执行，取代传统的执行机制和监督机制。即成员只有发言权和表决权，无执行权。智能合约是唯一的且执法者或执行者，保证议题在执行阶段的公平和效率。

为防止具有破坏性的议题的执行，采用以下策略：

（1） 最小公示期与最终方案支持者人数占总人数的比例成反比，以此增加领域专家参与会议的概率。

（2） 成员可以对可疑人员提出质疑，如果议题通过，可疑人员将从组织中移除。

（3） 冷静机制：成员可以在公示期冻结议题，同时该成员也进入冻结状态。等待其他成员的评估，解除冻结或取消议题。

在一些无法直接应用智能合约的场景，仍然需要选举出执行代表，选举过程与提案过程相同。并应遵循此原则：任何过程尽可能使用民主决策，如果暂时无法实现，必须给出具体条件，当满足条件的时候立即转换为民主决策（此规则也可使用智能合约编写）。

## Applications

### Decentralized Internet Platform With Privacy Computing

通过在多个不同云服务供应商中分别构造一个仅接受来自去中心化决策系统决策结果的指令的集群，集群之间使用阈值加密技术存储敏感信息，对外提供可验证的具有隐私保护的互联网服务。

每个集群创建过程如下：

1. 通过去中心化决策制定 Docker 初始化文件 DockerFile 或者类似的初始化脚本，并选举出管理员。
2. 管理员创建云服务器供应商的主帐号和仅有只读权限的副帐号（可查询主帐号所有操作记录）。
3. 管理员通过 DockerFile/初始化脚本 或者对应的镜像文件创建云服务器实例。
4. 实例在初始化时将关闭所有登录方式（此功能写在 DockerFile/初始化脚本 中），仅监听去中心化决策系统产生的决策结果并执行相应指令。

其中副账号的账号及密码向社会公开，任何人可检查云服务器是否按照规定的方式初始化，并且可访问主帐号的全部操作记录。拥有主帐号权限的管理员，除停止服务以外无其他特权。除了云服务供应商的任何人无法登录该服务器获取其中的数据或写入数据，云服务供应商即使拥有数据的读写权限，也无法修改或从阈值加密的数据中读取出有意义的信息（除非多数不同的云服务供应商联合并篡改其中的数据）。服务器在初始化以后的执行指令由去中心化的民主决策产生。

## 开发进度

[90%] libp2p

[80%] frontend

[] implement Asynchronous BFT

[] implement Asynchronous DKG

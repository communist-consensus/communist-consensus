# FIN: Practical Signautre-Free Asynchronous Common Subset in Constant Time

# Abstract

* ACS is a paradgim enabling BFT and MPC
* The most efficient ACS is BKR ACS

BKR:
* O(logn) time
* for a network of 16-64 replicas, ABA phase occupies about 95%-97% of the total runtime

FIN:
* O(n^3) messages with O(1) time
* information-theoretic and signature-free settings (both results can improve asymptotically and concretely)

An example shows:
* FIN reduces the overhead of the ABA phases to as low as 1.23% of the total runtime
* achieves up to 3.41x the throughput of PACE
* outperforms other BFT with standard liveness property (such as Dumbo and Speeding Dumbo)

# Introduction
## overview
FIN is first practical O(1)-time and O(n^3) asynchronous common subset protocol,
while prior constructions have either O(logn) time and O(n^3) messages or have O(1) time and O(n^4) messages
## History
ACS is due to Ben-Or, Canetti, and Goldreich (BCG) in the context of asynchronous MPC—under a different name called agreement on a core set. BCG proposed an ACS construction using RBC and ABA. Soon later BKR presented a refined and ppractical ACS construction using n RBC and b ABA instances. Meanwhiel BKR renamed "agreement on a core set " as "agreement on a common subset"
# Information-theoretic and signature-free settings
The unique benefits of information-theoretic/signature-free ACS:
* MPC
* Quantum safety
* Weaker cryptographic assumptions: Information-theoretic ACS can be realized using the standard Computational Diffie-Hellman assumption. others would need to use pairing assumptions to save communication costs.
* Liveness. IT-ACS achieve standard liveness. DAG-rider and Dumbo-NG require unbounded memory for liveness, Tusk and Bullshark achieve weak liveness.

# The open problem
...
# relatived work
* interactive consistency and vector consensus
ACS problem is an asynchronous version of interactive consistency and vector consensus.
ACS output requires the output of each correct replica contains n-f values such that at least n - 2f elements are proposed by correct replicas.
ACS is also called vector consensus.
* ACS constructions(in information-theoretic and signature-free settings)

existing two lines of ACS constructions:
- BKR: RBC + ABA
- RBC + MVBA

ours:
- information-theoretically secure MVBA and then to RBC with a constant number of RABA instances

* DispersedLedger
provides two general techniques:
allowing committing additional transactions from prior epochs
using asynchronous verifiable information dispersal
to improve the performance.they can be used to improve FIN.

* Separating message transmission from consensus.
Tusk, Bullshark, Dumbo-NG are BFT protocols the separate data transmission from consensus for higher throughput. FIN can use the technique to improve performance.
but they do nto achieve standard liveness.

* RBC.
CTRBC(using hashes)
EFBRB(information-theoretically secure)
CCBRB(using hashes and online error correction coding)

* RABA
...
* MVBA
...
* From atomic broadcast to ACS
unclear how to efficiently transform an atomic broadcast protocol to ACS

# system model and problem statement
* f <= Math.floor((n-1)/3)
* quorum is a set of Math.ceil((n+f+1)/2) replicas
* assume the existence of p2p authenticated channels between each pair of replicas
* asynchronous networks;no timing assumptions on message processing or transmission delays.
* static corruption: corrupted set at the beginning of the protocol is fixed.
* The ACS protocol in this paper achieves static security but it can be made adaptively secure if using an adaptively secure common coin protocol

* ACS: each replica holds an input,



```mermaid
graph TD;
isetup[initiator setup]
rsetup[resume/participant setup]
consensus[communicate via consensus protocol]

isetup --> isetup1[setup libp2p]
isetup1 --> isetup2[setup initial actions]
isetup2 --> |waiting for connection|consensus

rsetup --> |provide checkpoint block cid|rsetup1[setup libp2p]
rsetup1 --> |connect to any node|rsetup2[get prev latest blockchains proofs]
rsetup2 --> rsetup3[verify checkpoint and sync]
rsetup3 --> rsetup4

subgraph rsetup4[for each node]
    resume_rbc --> resume_aba
end

rsetup4 --> |reach aba threshold| epoch_finished

```

# RBC recovery
|remote status for node x|local status for node x|local action|remote action|
|---|---|---|---|
|not rec rbc_val of x|not rec rbc_val of x|broadcast unknown|ignore|
|not rec rbc_val of x|not rec enough rbc_echo of x|broadcast echo|ignore|
|not rec rbc_val of x|not rec enough rbc_ready of x|broadcast ready|ignore|
|not rec enough rbc_echo of x|not rec rbc_val of x|broadcast unknown|return rbc_val if self==x else rbc_echo|
|not rec enough rbc_echo of x|not rec enough rbc_echo of x|broadcast echo|return rbc_echo|
|not rec enough rbc_echo of x|not rec enough rbc_ready of x|broadcast ready|ignore|
|(not) rec enough rbc_ready of x|not rec rbc_val|broadcast unknown|return rbc_val if self==x else rbc_echo|
|(not) rec enough rbc_ready of x|not rec enough rbc_echo|broadcast echo|return rbc_echo|
|(not) rec enough rbc_ready of x|not rec enough rbc_ready|broadcast ready|return rbc_ready|


# ABA recovery
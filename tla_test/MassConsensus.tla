------------------------------ MODULE MassConsensus ------------------------------

(* An encoding of the asynchronous Byzantine consensus protocol in Fig.3 [1]: 

   [1] Bracha, Gabriel, and Sam Toueg. "Asynchronous consensus and broadcast protocols." 
   Journal of the ACM (JACM) 32.4 (1985): 824-840.
    
   Thanh Hai Tran, Igor Konnov, Josef Widder, 2016
 
   This file is a subject to the license that is bundled together with this package and can 
   be found in the file LICENSE.
 *)

EXTENDS Naturals, Integers, Sequences, FiniteSets, TLC

(* 拜占庭节点可能拒绝消息、发出相反的消息、延迟消息 *)
(* 诚实节点可能成为拜占庭节点，拜占庭节点可能成为诚实节点，但任一时刻的拜占庭节点总数小于F *)
CONSTANTS N, F, guardR1, guardR2, DEBUG

VARIABLES sent,
          consumed,  
          isByz, (* 拜占庭类型 0,非拜占庭，1，发送任意投票, 2沉默，诚实节点离线时也视为2类拜占庭 *)
          nByz, (* the number of Byzantine processes                      *)
          pc, (* 当前阶段 *)
          r (* 当前轮次*)
                          

ASSUME NF ==
  /\ DEBUG \in BOOLEAN
  /\ guardR1 \in Nat
  /\ guardR2 \in Nat
  /\ N \in Nat
  /\ F \in Nat
  /\ (N > F) /\ (F >= 0)
  /\ guardR1 > N \div 3
  /\ guardR2 > (2 * N) \div 3

Proc == 1 .. N
Location == { "prevote", "vote", "mainvote", "finalvote" }
vars == << sent, consumed, isByz, nByz, r, pc >>
Node == {
    "prevote0",
    "prevote1", (*prevote和vote阶段可能投票2次*)
    "vote0",
    "vote1",
    "mainvote0",
    "mainvote1",
    "mainvote*",
    "finalvote0",
    "finalvote1",
    "finalvote*"
}

rounds == 0 .. 2

Init ==  
  (* 0表示发送0;1表示发送1;2表示都发送或者不确定;3表示未发送 *)
  /\ sent = [ ro \in rounds |-> [loc \in Location |-> [i \in Proc |-> [j \in Proc |-> 3]]]] (* round -> location -> sender -> receiver -> 0|1|2|3*)
  (*收到消息后是否已处理;每一种消息只处理一次*)
  /\ consumed = [ro \in rounds |-> [i \in Proc |-> [node \in Node |-> 0]]]  (* round -> proc -> node -> 0|1 *)
  /\ r = [ i \in Proc |-> 0 ]
  /\ isByz = [ i \in Proc |-> 0 ]
  /\ nByz = 0
  /\ pc = [ i \in Proc |-> "init" ] (*当前阶段*)

BecomeByzantine1(i) ==
  /\ nByz < F
  /\ isByz[i] # 1
  /\ \/ isByz[i] = 2
     \/ /\ isByz[i] = 0
        /\ nByz' = nByz + 1  
  /\ isByz' = [ isByz EXCEPT ![i] = 1 ]  
  /\ UNCHANGED << pc , r, sent, consumed >>

BecomeByzantine2(i) ==
  /\ nByz < F
  /\ isByz[i] # 2
  /\ \/ isByz[i] = 1
     \/ /\ isByz[i] = 0
        /\ nByz' = nByz + 1  
  /\ isByz' = [ isByz EXCEPT ![i] = 2 ]  
  /\ UNCHANGED << pc , r, sent, consumed >>

BecomeHonest(i) ==
  /\ nByz > 0
  /\ isByz[i] > 0
  /\ nByz' = nByz - 1  
  /\ isByz' = [ isByz EXCEPT ![i] = 0 ]  
  /\ UNCHANGED << pc , r, sent, consumed >>

ArrSum(s) == LET
  RECURSIVE Helper(_)
  Helper(s_) == IF s_ = <<>> THEN 0 ELSE
  Head(s_) + Helper(Tail(s_))
IN Helper(s)

VoteSum(sender, loc, x) == 
    ArrSum([
        receiver \in Proc |-> IF sent[r[sender]][loc][receiver][sender] = x \/ 
         sent[r[sender]][loc][receiver][sender] = 2 THEN 1 ELSE 0])

VoteSumExact(sender, loc, x) ==
    ArrSum([
        receiver \in Proc |-> IF sent[r[sender]][loc][receiver][sender] = x THEN 1 ELSE 0])

broadcast(Op(_), _r, sender, loc) ==
    /\ sent' = [
      _round \in rounds |->
      IF _r = _round
      THEN [_loc \in Location |->
        IF loc = _loc
        THEN [_sender \in Proc |->
            IF sender = _sender
            THEN [receiver \in Proc |->
                Op(sent[_round][_loc][_sender][receiver])]
            ELSE sent[_round][_loc][_sender]]
        ELSE sent[_round][_loc]]
      ELSE sent[_round]]

ConsumeHonestPrevote0(sender) ==
  /\ \/ VoteSum(sender, "prevote", 0) >= guardR1
     \/ pc[sender] = "init"
  /\ broadcast(LAMBDA x: IF x = 1 THEN 2 ELSE 0, r[sender], sender, "prevote")
  /\ pc' = [pc EXCEPT ![sender] = IF @ # "init" THEN @ ELSE "prevote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestPrevote1(sender) ==
  /\ \/ VoteSum(sender, "prevote", 1) >= guardR1
     \/ pc[sender] = "init"
  /\ broadcast(LAMBDA x: IF x = 0 THEN 2 ELSE 1, r[sender], sender, "prevote")
  /\ pc' = [pc EXCEPT ![sender] = IF @ # "init" THEN @ ELSE "prevote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestVote0(sender) ==
  /\ \/ pc[sender] = "prevote"
     \/ pc[sender] = "vote"
  /\ VoteSum(sender, "prevote", 0) >= guardR2
  /\ consumed[r[sender]][sender]["prevote0"] = 1
  /\ broadcast(LAMBDA x: IF x = 1 THEN 2 ELSE 0, r[sender], sender, "vote")
  /\ pc' = [pc EXCEPT ![sender] = "vote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestVote1(sender) ==
  /\ \/ pc[sender] = "prevote"
     \/ pc[sender] = "vote"
  /\ VoteSum(sender, "prevote", 1) >= guardR2
  /\ consumed[r[sender]][sender]["prevote1"] = 1
  /\ broadcast(LAMBDA x: IF x = 0 THEN 2 ELSE 1, r[sender], sender, "vote")
  /\ pc' = [pc EXCEPT ![sender] = "vote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestMainVote0(sender) ==
  /\ pc[sender] = "vote"
  /\ VoteSum(sender, "vote", 0) >= guardR2
  /\ VoteSum(sender, "prevote", 0) >= guardR2
  /\ broadcast(LAMBDA x: 0, r[sender], sender, "mainvote")
  /\ pc' = [pc EXCEPT ![sender] = "mainvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestMainVote1(sender) ==
  /\ pc[sender] = "vote"
  /\ consumed[r[sender]][sender]["vote1"] = 1
  /\ consumed[r[sender]][sender]["prevote1"] = 1
  /\ VoteSum(sender, "vote", 1) >= guardR2
  /\ VoteSum(sender, "prevote", 1) >= guardR2
  /\ broadcast(LAMBDA x: 1, r[sender], sender, "mainvote")
  /\ pc' = [pc EXCEPT ![sender] = "mainvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestMainVoteStar(sender) ==
  /\ pc[sender] = "vote"
  /\ VoteSum(sender, "prevote", 0) >= guardR2
  /\ VoteSum(sender, "prevote", 1) >= guardR2
  /\ VoteSum(sender, "vote", 0) >= guardR1
  /\ VoteSum(sender, "vote", 1) >= guardR1
  /\ broadcast(LAMBDA x: 2, r[sender], sender, "mainvote")
  /\ pc' = [pc EXCEPT ![sender] = "mainvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestFinalVote0(sender) ==
  /\ pc[sender] = "mainvote"
  /\ VoteSum(sender, "mainvote", 0) >= guardR2
  /\ broadcast(LAMBDA x: 0, r[sender], sender, "finalvote")
  /\ pc' = [pc EXCEPT ![sender] = "finalvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestFinalVote1(sender) ==
  /\ pc[sender] = "mainvote"
  /\ consumed[r[sender]][sender]["mainvote1"] = 1
  /\ VoteSum(sender, "mainvote", 1) >= guardR2
  /\ broadcast(LAMBDA x: 1, r[sender], sender, "finalvote")
  /\ pc' = [pc EXCEPT ![sender] = "finalvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestFinalVoteStar(sender) ==
  /\ pc[sender] = "mainvote"
  /\ VoteSum(sender, "prevote", 0) >= guardR2
  /\ VoteSum(sender, "prevote", 1) >= guardR2
  /\ VoteSum(sender, "vote", 0) >= guardR1
  /\ VoteSum(sender, "vote", 1) >= guardR1
  /\ broadcast(LAMBDA x: 2, r[sender], sender, "finalvote")
  /\ pc' = [pc EXCEPT ![sender] = "finalvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeByz1(i) ==
    /\ \E v \in {0, 1, 2}:
        /\ \E loc \in Location:
           /\ \E receiver \in Proc:
               /\ sent' = [sent EXCEPT ![r[i]][loc][i][receiver] = v]
    /\ UNCHANGED << pc, consumed, r, isByz, nByz >>

Consume(sender) ==
  \/ /\ isByz[sender] = 0
     /\ \/ \E n \in Node:
           /\ consumed[r[sender]][sender][n] = 0 (*该阶段未处理*)
           /\ \/ /\ n = "prevote0"
                 /\ ConsumeHonestPrevote0(sender)
              \/ /\ n = "prevote1"
                 /\ ConsumeHonestPrevote1(sender)
              \/ /\ n = "vote0"
                 /\ ConsumeHonestVote0(sender)
              \/ /\ n = "vote1"
                 /\ ConsumeHonestVote1(sender)
              \/ /\ n = "mainvote0"
                 /\ ConsumeHonestMainVote0(sender)
              \/ /\ n = "mainvote1"
                 /\ ConsumeHonestMainVote1(sender)
              \/ /\ n = "mainvote*"
                 /\ ConsumeHonestMainVoteStar(sender)
              \/ /\ n = "finalvote0"
                 /\ ConsumeHonestFinalVote0(sender)
              \/ /\ n = "finalvote1"
                 /\ ConsumeHonestFinalVote1(sender)
              \/ /\ n = "finalvote*"
                 /\ ConsumeHonestFinalVoteStar(sender)
           /\ consumed' = [consumed EXCEPT ![r[sender]][sender][n] = 1]
  \/ /\ isByz[sender] = 1 (* 拜占庭节点向任意节点发送任意投票 *)
     /\ ConsumeByz1(sender)
  \/ /\ isByz[sender] = 2
     /\ UNCHANGED vars
  
Decide(i) ==
  /\ isByz[i] = 0
  /\ pc[i] = "finalvote"
  /\ \/ /\ VoteSumExact(i, "finalvote", 0) >= guardR2
        /\ VoteSumExact(i, "mainvote", 0) >= guardR1
        /\ pc' = [pc EXCEPT ![i] = "decide"]
        /\ UNCHANGED << sent, consumed, r, isByz, nByz >>
     \/ /\ VoteSumExact(i, "finalvote", 1) >= guardR2
        /\ VoteSumExact(i, "mainvote", 1) >= guardR1
        /\ pc' = [pc EXCEPT ![i] = "decide"]
        /\ UNCHANGED << sent, consumed, r, isByz, nByz >>
     \/ VoteSum(i, "finalvote", 0) >= guardR2
        /\ VoteSumExact(i, "mainvote", 2) >= guardR1
        /\ VoteSumExact(i, "finalvote", 0) < guardR2
        /\ VoteSumExact(i, "finalvote", 1) = 0
        /\ r' = [r EXCEPT ![i] = @ + 1]
        /\ pc' = [pc EXCEPT ![i] = "prevote"]
        /\ broadcast(LAMBDA x: 0, r[i] + 1, i, "prevote")
        /\ consumed' = [consumed EXCEPT ![r[i]][i]["prevote0"] = 1]
        /\ UNCHANGED << isByz, nByz >>
     \/ VoteSum(i, "finalvote", 1) >= guardR2
        /\ VoteSumExact(i, "mainvote", 2) >= guardR1
        /\ VoteSumExact(i, "finalvote", 1) < guardR2
        /\ VoteSumExact(i, "finalvote", 0) = 0
        /\ r' = [r EXCEPT ![i] = @ + 1]
        /\ pc' = [pc EXCEPT ![i] = "prevote"]
        /\ broadcast(LAMBDA x: 1, r[i] + 1, i, "prevote")
        /\ consumed' = [consumed EXCEPT ![r[i]][i]["prevote1"] = 1]
        /\ UNCHANGED << isByz, nByz >>
     \/ VoteSumExact(i, "finalvote", 1) + VoteSumExact(i, "finalvote", 0) + VoteSumExact(i, "finalvote", 2) >= guardR2
        /\ VoteSumExact(i, "finalvote", 1) < guardR2
        /\ VoteSumExact(i, "finalvote", 0) < guardR2
        /\ r' = [r EXCEPT ![i] = @ + 1]
        /\ pc' = [pc EXCEPT ![i] = "prevote"]
        (* 假设随机的结果为1 *)
        /\ broadcast(LAMBDA x: 1, r[i] + 1, i, "prevote")
        /\ consumed' = [consumed EXCEPT ![r[i]][i]["prevote1"] = 1]
        /\ UNCHANGED << isByz, nByz >>

Next == 
  /\ \E self \in Proc : 
     (*\/ BecomeByzantine1(self)*)
     (*\/ BecomeByzantine2(self)*)
     \/ BecomeHonest(self)
     \/ Consume(self) 
     \/ Decide(self)    
     \/ UNCHANGED vars          

Spec == Init /\ [][Next]_vars 
             /\ WF_vars(\E self \in Proc : \/ Consume(self)
                                           \/ Decide(self))

(*
TypeOK == 
  /\ pc \in [ Proc -> Location ]          
  /\ nSntE \in 0..N
  /\ nSntR \in 0..N
  /\ nByz \in 0..F
  /\ nRcvdE \in [ Proc -> 0..(nSntE + nByz) ]
  /\ nRcvdR \in [ Proc -> 0..(nSntR + nByz) ]
  *)
 
Symmetry == Permutations(Proc)

(* 如果诚实节点都反对，那么没有一个后续状态使得任意节点accept
Unforg_Ltl ==
  (\A i \in Proc :
   \/ isByz[i] # 0
   \/ pc[i] = "V0") => []( \A i \in Proc : pc[i] # "decide" )
 *)

(* Liveness check *)

(* 一定出现一种后续状态使得至少一个节点accept*)
Corr_Ltl == 
   []<>( \E i \in Proc : pc[i] = "decide" )

(* 如果至少一个诚实节点accept，那么所有诚实节点终将accept*)
Agreement_Ltl ==
  []((\E i \in Proc : pc[i] = "decide") => <>(\A i \in Proc : pc[i] = "decide" \/ isByz[i] # 0 ))
  
=============================================================================

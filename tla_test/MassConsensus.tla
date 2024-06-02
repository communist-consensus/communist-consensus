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

VARIABLES consumed,  
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
Phase == { "prevote", "vote", "mainvote", "finalvote" }
PhaseVote == { 0, 1, 2} (* 2 表示star *)
vars == << consumed, isByz, nByz, r, pc >>

rounds == 0 .. 1

Init ==  
  (*收到消息后是否已处理;每一种消息只处理一次*)
  /\ consumed = [ro \in rounds |-> [i \in Proc |-> [phase \in Phase |-> [x \in PhaseVote |-> 0]]]]  (* round -> proc -> phase -> 0|1|* -> 0|1 *)
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
  /\ UNCHANGED << pc , r, consumed >>

BecomeByzantine2(i) ==
  /\ nByz < F
  /\ isByz[i] # 2
  /\ \/ isByz[i] = 1
     \/ /\ isByz[i] = 0
        /\ nByz' = nByz + 1  
  /\ isByz' = [ isByz EXCEPT ![i] = 2 ]  
  /\ UNCHANGED << pc , r, consumed >>

BecomeHonest(i) ==
  /\ nByz > 0
  /\ isByz[i] > 0
  /\ nByz' = nByz - 1  
  /\ isByz' = [ isByz EXCEPT ![i] = 0 ]  
  /\ UNCHANGED << pc , r, consumed >>

ArrSum(s) == LET
  RECURSIVE Helper(_)
  Helper(s_) == IF s_ = <<>> THEN 0 ELSE
  Head(s_) + Helper(Tail(s_))
IN Helper(s)

VoteSum(sender, phase, v) == 
    ArrSum([receiver \in Proc |-> consumed[r[sender]][receiver][phase][v]])

ConsumeHonestPrevote(sender, v) ==
  /\ \/ v = 0
     \/ v = 1
  /\ VoteSum(sender, "prevote", v) >= guardR1
  /\ UNCHANGED << r, isByz, nByz, pc >>

ConsumeHonestVote(sender, v) ==
  /\ \/ v = 0
     \/ v = 1
  /\ \/ pc[sender] = "prevote"
     \/ pc[sender] = "vote"
  /\ VoteSum(sender, "prevote", v) >= guardR2
  /\ consumed[r[sender]][sender]["prevote"][v] = 1
  /\ pc' = [pc EXCEPT ![sender] = "vote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestMainVote(sender, v) ==
  /\ pc[sender] = "vote"
  /\ \/ /\ v = 2
        /\ VoteSum(sender, "prevote", 0) >= guardR2
        /\ VoteSum(sender, "prevote", 1) >= guardR2
        /\ VoteSum(sender, "vote", 0) >= guardR2
        /\ VoteSum(sender, "vote", 1) >= guardR2
     \/ /\ v # 2
        /\ consumed[r[sender]][sender]["vote"][v] = 1
        /\ consumed[r[sender]][sender]["prevote"][v] = 1
        /\ VoteSum(sender, "vote", v) >= guardR2
        /\ VoteSum(sender, "prevote", v) >= guardR2
  /\ pc' = [pc EXCEPT ![sender] = "mainvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeHonestFinalVote(sender, v) ==
  /\ pc[sender] = "mainvote"
  /\ \/ /\ v = 2
        /\ VoteSum(sender, "prevote", 0) >= guardR2
        /\ VoteSum(sender, "prevote", 1) >= guardR2
        /\ VoteSum(sender, "vote", 0) >= guardR1
        /\ VoteSum(sender, "vote", 1) >= guardR1
     \/ /\ v # 2
        /\ consumed[r[sender]][sender]["mainvote"][v] = 1
        /\ VoteSum(sender, "mainvote", v) >= guardR2
  /\ pc' = [pc EXCEPT ![sender] = "finalvote"]
  /\ UNCHANGED << r, isByz, nByz >>

ConsumeByz1(i) == UNCHANGED << pc, consumed, r, isByz, nByz >>

Consume(sender) ==
  \/ /\ isByz[sender] = 0
     /\ \/ /\ pc[sender] = "init"
           /\ \/ \E v \in {0, 1}:
                (* 去重，加速计算 *)
                 /\ \/ /\ v = 1 
                       /\ \/ sender = 1
                          \/ /\ sender # 1
                             /\ consumed[r[sender]][sender - 1]["prevote"][1] = 1
                    \/ v = 0

                 /\ consumed' = [consumed EXCEPT ![r[sender]][sender]["prevote"][v] = 1]
                 /\ pc' = [pc EXCEPT ![sender] = "prevote"]
                 /\ UNCHANGED << r, isByz, nByz >>
        \/ /\ pc[sender] # "init"
           /\ \/ \E phase \in Phase:
                 \/ \E v \in PhaseVote:
                    /\ consumed[r[sender]][sender][phase][v] = 0 (*该阶段未处理*)
                    /\ \/ ConsumeHonestPrevote(sender, v)
                       \/ ConsumeHonestVote(sender, v)
                       \/ ConsumeHonestMainVote(sender, v)
                       \/ ConsumeHonestFinalVote(sender, v)
                    /\ consumed' = [consumed EXCEPT ![r[sender]][sender][phase][v] = 1]
  \/ /\ isByz[sender] = 1 (* 拜占庭节点向任意节点发送任意投票 *)
     /\ ConsumeByz1(sender)
  \/ /\ isByz[sender] = 2
     /\ UNCHANGED vars
  
Decide(i) ==
  /\ isByz[i] = 0
  /\ pc[i] = "finalvote"
  /\ \/ /\ VoteSum(i, "finalvote", 0) >= guardR2
        /\ VoteSum(i, "mainvote", 0) >= guardR1
        /\ pc' = [pc EXCEPT ![i] = "decide"]
        /\ UNCHANGED << consumed, r, isByz, nByz >>
     \/ /\ VoteSum(i, "finalvote", 1) >= guardR2
        /\ VoteSum(i, "mainvote", 1) >= guardR1
        /\ pc' = [pc EXCEPT ![i] = "decide"]
        /\ UNCHANGED << consumed, r, isByz, nByz >>
     \/ VoteSum(i, "finalvote", 0) >= guardR2
        /\ VoteSum(i, "prevote", 0) >= guardR2
        /\ VoteSum(i, "prevote", 1) >= guardR2
        /\ VoteSum(i, "mainvote", 0) + VoteSum(i, "mainvote", 1) >= guardR1
        /\ VoteSum(i, "finalvote", 0) < guardR2
        /\ VoteSum(i, "finalvote", 1) = 0
        /\ r' = [r EXCEPT ![i] = @ + 1]
        /\ pc' = [pc EXCEPT ![i] = "prevote"]
        /\ consumed' = [consumed EXCEPT ![r[i]][i]["prevote"][0] = 1]
        /\ UNCHANGED << isByz, nByz >>
     \/ VoteSum(i, "finalvote", 1) >= guardR2
        /\ VoteSum(i, "prevote", 1) >= guardR2
        /\ VoteSum(i, "prevote", 0) >= guardR2
        /\ VoteSum(i, "mainvote", 0) + VoteSum(i, "mainvote", 1) >= guardR1
        /\ VoteSum(i, "finalvote", 1) < guardR2
        /\ VoteSum(i, "finalvote", 0) = 0
        /\ r' = [r EXCEPT ![i] = @ + 1]
        /\ pc' = [pc EXCEPT ![i] = "prevote"]
        /\ consumed' = [consumed EXCEPT ![r[i]][i]["prevote"][1] = 1]
        /\ UNCHANGED << isByz, nByz >>
     \/ VoteSum(i, "finalvote", 1) + VoteSum(i, "finalvote", 0) >= guardR2
        /\ VoteSum(i, "finalvote", 1) < guardR2
        /\ VoteSum(i, "finalvote", 0) < guardR2
        /\ r' = [r EXCEPT ![i] = @ + 1]
        /\ pc' = [pc EXCEPT ![i] = "prevote"]
        (* 假设随机的结果为1 *)
        /\ consumed' = [consumed EXCEPT ![r[i]][i]["prevote"][1] = 1]
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

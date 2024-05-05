import { ABAProtocolStage } from '../consensus';
import { IPFSAddress, NodeID, Signature } from '../common';
import { DBBlock } from './block';
import { EntityManager } from 'typeorm';

export enum ABAValue {
  false,
  true,
  any,
}

type BasicMessage = {
  sender: NodeID;
  root_block_cid: IPFSAddress<DBBlock>; // if it's a initial block, it should be undefined
  session_id: string;
  epoch: number;
  round: number;
};

export type ABABooleanValue = ABAValue.false | ABAValue.true;
export type ABAPreVoteMessage = BasicMessage & {
  stage: ABAProtocolStage.ABA_PREVOTE;
  val: ABABooleanValue;
};

export type ABAVoteMessage = BasicMessage & {
  stage: ABAProtocolStage.ABA_VOTE;
  val: ABABooleanValue;
};

export type ABAMainVoteMessage = BasicMessage & {
  stage: ABAProtocolStage.ABA_MAINVOTE;
  val: ABAValue;
};

export type ABAFinalVoteMessage = BasicMessage & {
  stage: ABAProtocolStage.ABA_FINALVOTE;
  val: ABAValue;
};

export type ABAMessage =
  | ABAPreVoteMessage
  | ABAVoteMessage
  | ABAMainVoteMessage
  | ABAFinalVoteMessage;

export type DBABAPrevote = {
  root_block_cid: IPFSAddress<DBBlock>;
  uuid: string;
  epoch: number;
  session_id: string;
  round: number;
  sender: string;
  val: number;
  signature: Signature<ABAMessage>,
};

export type DBABAInfo = {
  root_block_cid: IPFSAddress<DBBlock>;
  uuid?: string;
  epoch: number;
  session_id: string;
  round: number;
  stage: ABAProtocolStage;
  val: ABAValue;
};

export type DBABALog = {
  uuid?: string;
  root_block_cid: IPFSAddress<DBBlock>;
  epoch: number;
  session_id: string;
  round: number;
  stage: ABAProtocolStage;
  sender: string;
  val: ABAValue;
  signature: Signature<ABAMessage>;
};

/**
 * 证明node_id在ABA协议中的输出
 * 
 * 证明由N-f个对final msg的签名组成
 * 
 * 整个ABA协议的证明包含N个ABAProof，每个aba proof证明了一个node_id的decided val，即使它输出0
 * */ 
export type ABAProof = {
  node_id: NodeID;
  round: number;
  val: boolean;
  // order by node id in ascending order
  signatures: {
    signatory: NodeID;
    signature: Signature<ABAFinalVoteMessage>;
  }[];
};
import { EntityManager } from "typeorm";
import { Action, Actions, DBBlock, RBCEchoMessage, RBCReadyMessage, RBCValMessage } from "../../../src/backend/types";
import { Encoded, IPFSAddress, NodeID, Signature } from "../common";

export enum RBCStage {
  VAL,
  ECHO,
  READY,
  RESOLVED,
}
export interface DBRBCResolved {
  uuid?: string;
  root_block_cid: IPFSAddress<DBBlock>;
  epoch: number;
  provider: NodeID;
  cid: IPFSAddress<Actions>;
}

export interface DBRBCVal extends Omit<Omit<RBCValMessage, 'branch'>, 'stage'> {
  uuid?: string;
  branch: Uint8Array;
  signature: Signature<RBCValMessage>;
}

export interface DBRBCEcho extends Omit<Omit<RBCEchoMessage, 'branch'>, 'stage'> {
  uuid?: string;
  branch: Uint8Array;
  signature: Signature<RBCEchoMessage>;
}

export interface DBRBCReady extends Omit<RBCReadyMessage, 'stage'> {
  uuid?: string;
  signature: Signature<RBCReadyMessage>;
}

/**
 * 证明一个节点在RBC协议中广播了Actions
 * 
 * 由N-f个节点的RBCReady签名组成
 */
export type RBCProof = {
  node_id: NodeID;
  cid: IPFSAddress<Actions>;
  signatures: {
    signatory: NodeID;
    signature: Signature<RBCReadyMessage>;
  }[]
};

export * from '../../shared/types';
import { DataSourceOptions, EntityManager } from 'typeorm';
import { ABABooleanValue, ABAMessage, ABAProtocolStage, ABAValue, Action, Actions, DBBlock, IDHTHelperCommonMessage, IPFSAddress, NodeID, RBCProtocols, RBCProtocolStage } from '../../shared/types';

export type IABAEvents = {
  broadcast: (manager: EntityManager, msg: ABAMessage) => void;
};

export interface IRBCProof {
  data: Uint8Array;
  cid: string; // data cid
  signature: Uint8Array;
}

export type RBCValMessage = {
  stage: RBCProtocolStage.RBC_VAL,
  root_block_cid: IPFSAddress<DBBlock>;
  epoch: number;
  branch: string[];
  piece: Uint8Array;
  roothash: string;
  piece_provider: NodeID;
  piece_receiver: NodeID;
};
export type RBCEchoMessage = {
  stage: RBCProtocolStage.RBC_ECHO,
  root_block_cid: IPFSAddress<DBBlock>;
  epoch: number;
  piece_provider: NodeID;
  piece_receiver: NodeID;
  branch: string[];
  piece: Uint8Array;
  roothash: string;
  sender: NodeID;
};
export type RBCReadyMessage = {
  root_block_cid: IPFSAddress<DBBlock>;
  stage: RBCProtocolStage.RBC_READY,
  epoch: number;
  provider: NodeID;
  cid: IPFSAddress<Actions>;
  sender: NodeID;
};

export type RBCMessage = RBCValMessage | RBCEchoMessage | RBCReadyMessage;
export type IRBCEvents = {
  receiveVal: (sender: string, data: RBCValMessage) => Promise<void>;
  receiveEcho: (sender: string, data: RBCEchoMessage) => Promise<void>;
  receiveReady: (sender: string, data: RBCReadyMessage, signature: Uint8Array) => Promise<void>;

  resolveOne: (node_id: NodeID, proof: IRBCProof) => void;
  abort: () => void;
};

export enum RBCFromWorkerMessageType {
  resolveOne,
  rpc,
  addListener,
}
export enum RBCRPCScope {
  dht_helper = 'dht_helper',
}
export type RBCFromWorkerMessage =
  | {
      type: RBCFromWorkerMessageType.resolveOne;
      node_id: NodeID;
    }
  | {
      type: RBCFromWorkerMessageType.addListener;
      subProtocol: RBCProtocols;
    }
  | {
      type: RBCFromWorkerMessageType.rpc;
      scope:RBCRPCScope;
      args: any[];
      fn: string;
      call_id?: string;
    };

export enum RBCToWorkerMessageType {
  RBCinternal,
  RPCResponse,
}
export type RBCToWorkerMessage =
  | {
      type: RBCToWorkerMessageType.RPCResponse;
      call_id: string,
      data: any;
    }
  | IDHTHelperCommonMessage<RBCProtocols> & {
      type: RBCToWorkerMessageType.RBCinternal;
      peer: NodeID;
    };

export interface IRBCWorkerInitialData {
  node_id: string;
  epoch: number;
  N: number;
  f: number;
  input: Action[];
  sk: Uint8Array;
  root_block_cid: IPFSAddress<DBBlock>;
  datasource_options: DataSourceOptions; // except for entities
}
export * from '../../shared/types';
import { ABABooleanValue, ABAValue, IABAPRoof, IDBABA, NodeID } from '../../shared/types';

export type IABAEvents = {
  resolveOne: (node_id: NodeID, proof: IABAPRoof) => void;

  receiveFinal: (
    sender: string,
    store: IDBABA,
    r: number,
    v: ABAValue,
  ) => void;
  receivePrevote: (
    sender: string,
    store: IDBABA,
    r: number,
    v: ABABooleanValue,
  ) => void;
  receiveVote: (
    sender: string,
    store: IDBABA,
    r: number,
    v: ABABooleanValue,
  ) => void;
  receiveMainVote: (
    sender: string,
    store: IDBABA,
    r: number,
    v: ABAValue,
  ) => void;
};

export interface IRBCProof {
  data: Uint8Array;
  cid: string; // data cid
  signature: Uint8Array;
}


export enum RBCMessageType {
  VAL,
  ECHO,
  READY,
}
export type VALMessage = {
  type: RBCMessageType.VAL;
  epoch: number;
  branch: string[];
  piece: Uint8Array;
  roothash: string;
};
export type ECHOMessage = {
  type: RBCMessageType.ECHO;
  epoch: number;
  sourceProvider: NodeID;
  pieceOwner: NodeID;
  branch: string[];
  piece: Uint8Array;
  roothash: string;
};
export type READYMessage = {
  type: RBCMessageType.READY;
  epoch: number;
  sourceProvider: NodeID;
  sourceProviderMsgCID: string;
};

export type RBCMessage = VALMessage | ECHOMessage | READYMessage;
export type IRBCEvents = {
  receiveVal: (sender: string, data: VALMessage) => Promise<void>;
  receiveEcho: (sender: string, data: ECHOMessage) => Promise<void>;
  receiveReady: (sender: string, data: READYMessage, signature: Uint8Array) => Promise<void>;

  resolveOne: (node_id: NodeID, proof: IRBCProof) => void;
  abort: () => void;
};

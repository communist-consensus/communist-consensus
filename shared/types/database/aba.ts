import { BlockContext } from '../consensus';
import { IPFSAddress, NodeID } from '../common';

export enum ABAValue {
  false,
  true,
  any,
}

export type ABABooleanValue = ABAValue.false | ABAValue.true;

export interface IABAPRoof {
}
export interface IDBABA {
  set_prevote: (epoch: number, session_id: string, round: number, node_id: NodeID, v: ABABooleanValue) => Promise<void>;
  has_prevote: (epoch: number, session_id: string, round: number, node_id: NodeID, v: ABABooleanValue) => Promise<boolean>;
  get_prevote_count: (epoch: number, session_id: string, round: number, v: ABABooleanValue) => Promise<number>;

  set_vote: (epoch: number, session_id: string, round: number, node_id: NodeID, v: ABABooleanValue) => Promise<void>;
  has_vote: (epoch: number, session_id: string, round: number, node_id: NodeID) => Promise<boolean>;
  get_vote_count: (epoch: number, session_id: string, round: number, v: ABABooleanValue) => Promise<number>;
  get_vote_size: (epoch: number, session_id: string, round: number, ) => Promise<number>;

  set_main_vote: (epoch: number, session_id: string, round: number, node_id: NodeID, v: ABAValue) => Promise<void>;
  has_main_vote: (epoch: number, session_id: string, round: number, node_id: NodeID) => Promise<boolean>;
  get_main_vote_size: (epoch: number, session_id: string, round: number, ) => Promise<number>;
  get_main_vote_count: (epoch: number, session_id: string, round: number, v: ABAValue) => Promise<number>;

  set_final_vote: (epoch: number, session_id: string, round: number, node_id: NodeID, v: ABAValue) => Promise<void>;
  has_final_vote: (epoch: number, session_id: string, round: number, node_id: NodeID) => Promise<boolean>;
  get_final_vote_size: (epoch: number, session_id: string, round: number, ) => Promise<number>;
  get_final_vote_count: (epoch: number, session_id: string, round: number, v: ABAValue) => Promise<number>;
}

export enum ABAStage {
  prevote,
  vote,
  mainvote,
  finalvote,
}

export type DBABAPrevote = {
  id: number;
  epoch: number;
  session_id: string;
  round: number;
  sender: string;
  val: number;
};

export type DBABA = {
  id: number;
  epoch: number;
  session_id: string;
  round: number;
  stage: ABAStage;
  sender: string;
  val: number;
};

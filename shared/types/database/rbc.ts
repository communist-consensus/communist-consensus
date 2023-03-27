import { NodeID } from "../common";

export interface IDBRBC {
  set_val: (epoch: number, node_id: NodeID, v: Buffer) => Promise<void>;
  has_val: (epoch: number, node_id: NodeID) => Promise<boolean>;
  get_val: (epoch: number, node_id: NodeID) => Promise<Buffer | undefined>;

  set_echo: (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
    roothash: string,
    v: Buffer,
  ) => Promise<void>;
  get_echo: (
    epoch: number,
    source_provider: NodeID,
    roothash: string,
  ) => Promise<Buffer[]>;
  has_echo: (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
  ) => Promise<boolean>;
  get_echo_size: (
    epoch: number,
    source_provider: NodeID,
    roothash: string,
  ) => Promise<number>;

  set_ready: (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
    cid: string,
    signature: Buffer,
  ) => Promise<void>;
  get_ready_size: (
    epoch: number,
    source_provider: NodeID,
    cid: string
  ) => Promise<number>;
  get_ready: (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
  ) => Promise<Buffer | undefined>;
  has_ready: (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
  ) => Promise<boolean>;
}

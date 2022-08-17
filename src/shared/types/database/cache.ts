import { IPFSAddress, MID_B58 } from '../common';
import { Domain, DomainID, PeerStatus, ProposalID, ProposalProperties, ProposalStatus, SolutionID, WitnessTestimony } from '../r-internationale';
export type WitnessTestimonyCache = {
  witness_testimony: WitnessTestimony,
  src: Uint8Array,
  args: any,
}
export interface IDBCache {
  actions_testimony_forwarded: Map<MID_B58, boolean>;
  witness_testimony_forwarded: Map<IPFSAddress, Map<MID_B58, IPFSAddress>>;
  witness_testimony_forwarded_flat: {
    witnesses: MID_B58[];
    witness_signatures: Uint8Array[];
    witness_testimony_cids: IPFSAddress[];
  };

  get_witness_testimony_cache: () => Promise<
    Map<MID_B58, WitnessTestimonyCache>
  >;
  set_witness_testimony_cache: (
    mid: MID_B58,
    wtc: WitnessTestimonyCache,
  ) => Promise<void>;

  set_actions_testimony_forwarded: (mid: MID_B58) => Promise<void>;

  get_witnesses_and_signature_cids: (
    testimony_cid: IPFSAddress,
  ) => Promise<{
    witnesses: MID_B58[];
    witness_signature_cids: IPFSAddress[];
  }>;

  count_witnesses: (testimony_cid: IPFSAddress) => Promise<number>;
  is_actions_testimony_forwarded: (mid: MID_B58) => Promise<boolean>;

  set_witness_testimony_forwarded: (
    testimony_cid: IPFSAddress,
    mid: MID_B58,
    signature_cid: IPFSAddress,
    signature: Uint8Array,
  ) => Promise<void>;

  is_witness_testimony_forwarded: (
    testimony_cid: IPFSAddress,
    mid: MID_B58,
  ) => Promise<boolean>;

  clear_forwarded: () => Promise<boolean>;
  clear_witness_testimony_cache: () => Promise<boolean>;
}
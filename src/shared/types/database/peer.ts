import { IPFSAddress, MID_B58 } from '../common';
import { RsaPublicKey, RsaPrivateKey } from 'libp2p-crypto/src/keys/rsa-class';
import { Profile, Domain, DomainID, PeerStatus, ProposalID, ProposalProperties, ProposalStatus, SolutionID, ModifiableProfile } from '../r-internationale';

export type DBPeer = {
  id: string;
  name: string;
  proof_cid: string;
  public_key: Uint8Array;
  status: PeerStatus;
};

export interface IDBPeer {
  get_peer: (mid: MID_B58) => Promise<DBPeer>;
  get_peers: (page: number, n?: number) => Promise<DBPeer[]>;
  get_n_known_peers: () => Promise<number>;
  get_pubkey_by_mid: (mid: MID_B58) => Promise<Uint8Array>;
  add_peer: (profile: Profile) => Promise<void>;
  has: (mid: MID_B58) => Promise<boolean>;
  get_status: (mid: MID_B58) => Promise<PeerStatus>;
  set_status: (mid: MID_B58, status: PeerStatus) => Promise<void>;
  remove: (mid: MID_B58) => Promise<void>;
  modify_profile: (mid, profile: ModifiableProfile) => Promise<void>;
  freeze: (mid: MID_B58) => Promise<void>;
}
import { IPFSAddress, NodeID as ID_B58 } from '../common';
import { RsaPublicKey, RsaPrivateKey } from 'libp2p-crypto/src/keys/rsa-class';
import {
  Profile,
  Domain,
  DomainID,
  PeerStatus,
  ProposalID,
  ProposalProperties,
  ProposalStatus,
  SolutionID,
  ModifiableProfile,
} from '../consensus';

export type DBPeer = {
  id: string;
  name: string;
  proof_cid: string;
  public_key: Uint8Array;
  status: PeerStatus;
};

export interface IDBPeer {
  get_peer: (id: ID_B58) => Promise<DBPeer>;
  get_peers: () => Promise<DBPeer[]>;
  get_pubkey: (id: ID_B58) => Promise<Uint8Array>;
  add_peer: (profile: Profile) => Promise<void>;
  get_status: (id: ID_B58) => Promise<PeerStatus>;
  set_status: (id: ID_B58, status: PeerStatus) => Promise<void>;
  remove: (id: ID_B58) => Promise<void>;
  modify_profile: (id: ID_B58, profile: ModifiableProfile) => Promise<void>;
  freeze: (id: ID_B58) => Promise<void>;
}

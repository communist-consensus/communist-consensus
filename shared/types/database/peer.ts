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
import { EntityManager } from 'typeorm';

export type DBPeer = {
  uuid: string;
  name: string;
  proof_cid: string;
  public_key: Uint8Array;
  status: PeerStatus;
  index: number;
};
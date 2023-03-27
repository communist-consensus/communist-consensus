import { IDatabase, ModifiableProfile, Profile } from '../../../shared/types';
import {
  b64pad_to_uint8array,
  pubkey_to_mid,
  uint8array_to_b58,
} from '../../../shared/utils';
import { IDBPeer, PeerStatus, PublicKey, NodeID, IPFSAddress } from '../types';
import Peer from './entity/peer';
import debug from 'debug';
import { EntityManager } from 'typeorm';
const log = debug('blockchain-database-peer');

export default (manager: EntityManager): IDBPeer => ({
  async get_peer(mid: NodeID) {
    return await manager.findOne(Peer, mid);
  },

  async get_peers() {
    return await manager.find(Peer, {});
  },

  async add_peer(profile: Profile) {
    const pubkey_uint8 = b64pad_to_uint8array(profile.public_key);
    const id = await pubkey_to_mid(pubkey_uint8);
    await manager.insert(Peer, {
      id,
      name: profile.name,
      proof_cid: profile.proof_cid,
      public_key: Buffer.from(pubkey_uint8),
      status: PeerStatus.active,
    });
  },

  async get_pubkey(mid: NodeID) {
    const peer = await manager.findOne(Peer, { id: mid });
    if (!peer.public_key) {
      debugger;
    }
    return peer ? peer.public_key : undefined;
  },

  async get_status(mid: NodeID) {
    const peer = await manager.findOne(Peer, { id: mid });
    return peer.status;
  },

  async remove(mid: NodeID) {
    // TODO unfreeze proposal, failed or executed
  },

  async set_status(mid: NodeID, status: PeerStatus) {
    await manager.update(Peer, { id: mid }, { status });
  },

  async modify_profile(mid, profile: ModifiableProfile) {
    await manager.update(Peer, { id: mid }, { ...profile });
  },

  async freeze(mid: NodeID) {
    await manager.update(Peer, { id: mid }, { status: PeerStatus.freezed });
  },
});

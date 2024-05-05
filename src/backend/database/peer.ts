import { IDatabase, ModifiableProfile, Profile } from '../../../shared/types';
import {
  b64pad_to_uint8array,
  pubkey_to_node_id,
  uint8array_to_b58,
} from '../../../shared/utils';
import {
  PeerStatus,
  PublicKey,
  NodeID,
  IPFSAddress,
  DBPeer,
} from '../types';
import Peer from './entity/peer';
import debug from 'debug';
import { EntityManager, QueryRunner } from 'typeorm';
const log = debug('blockchain-database-peer');

export async function get_peer(manager, mid: NodeID) {
  return await manager.findOne(Peer, { where: { uuid: mid } });
}

export async function get_n_peer(manager) {
  return await manager.count(Peer, {});
}

export async function get_peer_index(manager, mid: NodeID) {
  return (await manager.findOne(Peer, { where: { uuid: mid } })).index;
}

export async function has_peer(manager, mid: NodeID) {
  return !!(await manager.findOne(Peer, { where: { uuid: mid } }));
}

export async function get_peers(manager) {
  return await manager.find(Peer, {
    order: {
      uuid: 'ASC',
    },
  });
}

export async function add_peer(manager: EntityManager, profile: Profile) {
  const pubkey_uint8 = b64pad_to_uint8array(profile.public_key);
  const id = await pubkey_to_node_id(pubkey_uint8);
  const n = await manager.count(Peer, {});
  const peer: DBPeer = {
    uuid: id,
    name: profile.name,
    proof_cid: profile.proof_cid,
    public_key: Buffer.from(pubkey_uint8),
    index: n,
    status: PeerStatus.active,
  }
  await manager.insert(Peer, peer);
}

export async function get_pubkey(manager, mid: NodeID) {
  const peer = await manager.findOne(Peer, { where: { uuid: mid } });
  if (!peer.public_key) {
    debugger;
  }
  return peer ? peer.public_key : undefined;
}

export async function get_status(manager, mid: NodeID) {
  const peer = await manager.findOne(Peer, { where: { uuid: mid } });
  return peer.status;
}

export async function remove(manager, mid: NodeID) {
  // TODO unfreeze proposal, failed or executed
}

export async function set_status(manager, mid: NodeID, status: PeerStatus) {
  await manager.update(Peer, { id: mid }, { status });
}

export async function modify_profile(manager, mid, profile: ModifiableProfile) {
  await manager.update(Peer, { id: mid }, { ...profile });
}

export async function freeze(manager, mid: NodeID) {
  await manager.update(Peer, { id: mid }, { status: PeerStatus.freezed });
}

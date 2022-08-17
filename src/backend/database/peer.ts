import { IDatabase, ModifiableProfile, Profile } from '../../shared/types';
import { pubkey_str_to_uint8array, pubkey_to_mid, uint8array_to_b58 } from '../../shared/utils';
import PeerId from 'peer-id';
import {
  IDBPeer,
  PeerStatus,
  PublicKey,
  MID_B58,
  IPFSAddress,
} from '../types';
import Peer from './entity/peer';
import debug from 'debug';
const log = debug('blockchain-database-peer');

export default class DBPeer implements IDBPeer {
  db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async get_n_known_peers() {
    return await this.db.connection.manager.count(Peer);
  }

  public async get_peer(mid: MID_B58) {
    return await this.db.connection.manager.findOne(Peer, mid);
  }

  public async get_peers(page, n = 20) {
    return await this.db.connection.manager.find(Peer, {
      where: {},
      take: n,
      skip: (page - 1) * n,
    });
  }

  public async add_peer(profile: Profile) {
    const pubkey_uint8 = pubkey_str_to_uint8array(profile.public_key)
    const id = await pubkey_to_mid(pubkey_uint8);
    await this.db.connection.manager.insert(Peer, {
      id,
      name: profile.name,
      proof_cid: profile.proof_cid,
      public_key: Buffer.from(pubkey_uint8),
      status: PeerStatus.active,
    });
  }

  public async get_pubkey_by_mid(mid: MID_B58) {
    const peer = await this.db.connection.manager.findOne(Peer, { id: mid });
    if (!peer.public_key) {
      debugger;
    }
    return peer ? peer.public_key : undefined;
  }

  public async get_status(mid: MID_B58) {
    const peer = await this.db.connection.manager.findOne(Peer, { id: mid });
    return peer.status;
  }

  public async remove(mid: MID_B58) {
    // TODO unfreeze proposal, failed or executed
  }

  public async has(mid: MID_B58) {
    const peer = await this.db.connection.manager.findOne(Peer, { id: mid });
    return !!peer;
  }

  public async set_status(mid: MID_B58, status: PeerStatus) {
    await this.db.connection.manager.update(Peer, { id: mid }, { status });
  }

  public async modify_profile(mid, profile: ModifiableProfile) {
    await this.db.connection.manager.update(Peer, { id: mid }, { ...profile });
  }

  public async freeze(mid: MID_B58) {
    await this.set_status(mid, PeerStatus.freezed);
  }
}

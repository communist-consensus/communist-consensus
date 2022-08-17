import { WitnessTestimony, WitnessTestimonyCache } from '../../shared/types';
import { IDBCache, MID_B58, IPFSAddress } from '../types';

export default class APICache implements IDBCache {
  actions_testimony_forwarded = new Map<MID_B58, boolean>();

  // testimony_cid, mid, signature_cid
  witness_testimony_forwarded = new Map<
    IPFSAddress,
    Map<MID_B58, IPFSAddress>
  >();
  witness_testimonies = new Map<MID_B58, WitnessTestimonyCache>();

  witness_testimony_forwarded_flat: {
    witnesses: MID_B58[];
    witness_signatures: Uint8Array[];
    witness_testimony_cids: IPFSAddress[];
  } = {
    witnesses: [],
    witness_signatures: [],
    witness_testimony_cids: [],
  };

  public async set_actions_testimony_forwarded(mid: MID_B58) {
    this.actions_testimony_forwarded.set(mid, true);
  }

  public async is_actions_testimony_forwarded(mid: MID_B58) {
    return this.actions_testimony_forwarded.get(mid);
  }

  public async get_witnesses_and_signature_cids(testimony_cid: IPFSAddress) {
    const m = this.witness_testimony_forwarded.get(testimony_cid);
    return m
      ? {
          witnesses: Array.from(m.keys()),
          witness_signature_cids: Array.from(m.values()),
        }
      : {
          witnesses: [],
          witness_signature_cids: [],
        };
  }

  public async set_witness_testimony_forwarded(
    testimony_cid: IPFSAddress,
    mid: MID_B58,
    signature_cid: IPFSAddress,
    signature: Uint8Array,
  ) {
    const m = this.witness_testimony_forwarded.get(testimony_cid);
    if (!m) {
      const m2 = new Map<MID_B58, IPFSAddress>();
      m2.set(mid, signature_cid);
      this.witness_testimony_forwarded.set(testimony_cid, m2);
    } else {
      if (m.get(mid)) {
        return;
      }
      m.set(mid, signature_cid);
    }

    this.witness_testimony_forwarded_flat.witnesses.push(mid);
    this.witness_testimony_forwarded_flat.witness_signatures.push(signature);
    this.witness_testimony_forwarded_flat.witness_testimony_cids.push(testimony_cid);
  }

  public async is_witness_testimony_forwarded(
    testimony_cid: IPFSAddress,
    mid: MID_B58,
  ) {
    const a = this.witness_testimony_forwarded.get(testimony_cid);
    return !!(a && a.get(mid));
  }

  public async count_witnesses(testimony_cid: IPFSAddress) {
    const a = this.witness_testimony_forwarded.get(testimony_cid);
    return a ? a.size : 0;
  }

  public async set_witness_testimony_cache(
    mid: MID_B58,
    wtc: WitnessTestimonyCache,
  ) {
    this.witness_testimonies.set(mid, wtc);
  }

  public async get_witness_testimony_cache() {
    return this.witness_testimonies;
  }

  public async clear_witness_testimony_cache() {
    this.witness_testimonies.clear();
    return true;
  }

  public async clear_forwarded() {
    this.actions_testimony_forwarded.clear();
    this.witness_testimony_forwarded.clear();
    this.witness_testimony_forwarded_flat.witnesses = [];
    this.witness_testimony_forwarded_flat.witness_signatures = [];
    this.witness_testimony_forwarded_flat.witness_testimony_cids = [];
    return true;
  }
}

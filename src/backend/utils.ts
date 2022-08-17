import {
  IPFSAddress,
  Witnesses,
  WitnessTestimonyCIDs,
  WitnessSignatures,
  ActionBundle,
  ActionSignatures,
  ActionSubjects,
  Actions,
  WitnessTestimony,
  ActionSubject,
  ActionSignature,
  ActionsTestimony,
  Context,
} from './types';
import {
  RSA_verify,
  hash,
  intersect,
  decode,
  encode,
} from '../shared/utils';
import crypto from 'libp2p-crypto';

import IPFS from './ipfs';
import Database from './database';

export * from '../shared/utils';

export async function get_intersection_actions(
    ctx: Context,
    before_prev_block_hash: IPFSAddress,
    prev_block_hash: IPFSAddress,
    witnesses: Witnesses,
    witness_testimony_cids: WitnessTestimonyCIDs,
    witness_signatures: WitnessSignatures,
    actions_broadcast_window_start: number,
  ): Promise<{
    action_bundle: ActionBundle;
    action_signatures: ActionSignatures;
    action_subjects: ActionSubjects;
  }> {
    const ipfs = ctx.ipfs;
    if (
      witnesses.length !== witness_signatures.length ||
      witnesses.length !== witness_testimony_cids.length
    ) {
      throw new Error(
        'witnesses length is different from witness signs or testimony cids',
      );
    }
    const candidates: {cid: IPFSAddress, count: number}[] = [];
    const count = new Map<IPFSAddress, {cid: IPFSAddress, count: number}>();
    for (const cid of witness_testimony_cids) {
      const data = count.get(cid);
      if (!data) {
        const new_data = {
          cid,
          count: 1,
        };
        count.set(cid, new_data);
        candidates.push(new_data);
        continue;
      } else {
        data.count++;
      }
    }
    const sorted_candidates = candidates.sort((a, b) => b.count - a.count);
    const final_candidates = [];
    let n_witness = 0;
    const n_total = await ctx.db.peer.get_n_known_peers();
    for (const candidate of sorted_candidates) {
      n_witness += candidate.count;
      final_candidates.push(candidate);
      if (n_witness > n_total / 2) {
        break;
      }
    }

    const testimonies = await Promise.all(final_candidates.map(i => ipfs.get<WitnessTestimony>(i.cid)));
    const id_to_data = new Map<string, [Actions, ActionSubject, ActionSignature]>();
    const res_candidates: string[][] = [];
    for (const testimony of testimonies) {
      if (testimony.prev_block_hash !== prev_block_hash) {
        continue;
      }
      if (testimony.actions_broadcast_window_start !== actions_broadcast_window_start) {
        continue;
      }
      const action_bundle = await ipfs.get<ActionBundle>(testimony.action_bundle_cid);
      const action_subjects = await ipfs.get<ActionSubjects>(testimony.action_subjects_cid);
      const action_signatures = await ipfs.get<ActionSignatures>(testimony.action_signatures_cid);
      let verified = true;
      for (const i in action_subjects) {
        const testimony: ActionsTestimony = {
          actions: action_bundle[i],
          before_prev_block_hash,
          mid: action_subjects[i],
          start_timestamp: actions_broadcast_window_start,
        };
        if (
          !(await RSA_verify(
            crypto.keys.unmarshalPublicKey(
              await ctx.db.peer.get_pubkey_by_mid(action_subjects[i]),
            ),
            encode(testimony),
            action_signatures[i],
          ))
        ) {
          verified = false;
          break;
        }
      }
      if (!verified) {
        continue;
      }
      const ids: string[] = [];
      for (const i in action_subjects) {
        const id = hash(action_signatures[i]);
        ids.push(id);
        id_to_data.set(id, [action_bundle[i], action_subjects[i], action_signatures[i]]);
      }
      res_candidates.push(ids);
    }
    let res_ids = res_candidates[0];
    for (const i of res_candidates) {
      res_ids = intersect(res_ids, i)
    }

    const res: {
      action_bundle: ActionBundle,
      action_signatures: ActionSignatures,
      action_subjects: ActionSubjects,
    } = {
      action_bundle: [],
      action_subjects: [],
      action_signatures: [],
    };
    if (res_ids) {
      for (const id of res_ids) {
        const data = id_to_data.get(id);
        res.action_bundle.push(data[0]);
        res.action_subjects.push(data[1]);
        res.action_signatures.push(data[2]);
      }
    }
    return res;
  }

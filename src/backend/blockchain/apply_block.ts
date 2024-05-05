import { MIN_ONLINE_RATE } from '../../../shared/constant';
import crypto from 'libp2p-crypto';
import * as block_store from '../database/block';
import * as aba_store from '../database/aba';
import * as rbc_store from '../database/rbc';
import {
  ABAProof,
  ABAProtocolStage,
  ABAValue,
  Context,
  DBBlock,
  IPFSAddress,
  RBCProof,
  RBCProtocolStage,
} from '../../../shared/types';
import { decode, encode, b64pad_to_uint8array } from '../../../shared/utils';
import apply_actions from './apply_actions';
import { sub_transation } from '../database/utils';
import RBCReady from '../database/entity/rbc-ready';
import { RBCReadyMessage } from '../types';

export async function verify_block(ctx: Context) {
  /*
  const { prev_block_hash, action_bundle_cid, n_peer: n_peer } = block;
  const witness_signature_cids = await ctx.ipfs.get<IPFSAddress[]>(
    witness_signatures_cid,
  );
  const witness_signatures: WitnessSignatures = await Promise.all(
    witness_signature_cids.map((i) => ctx.ipfs.get<WitnessSignature>(i)),
  );
  const witnesses = await ctx.ipfs.get<Witnesses>(witnesses_cid);

  if (n_peer) {
    let n_supporter = 0;
    for (let i = 0; i < witnesses.length; ++i) {
      const mid_b58 = witnesses[i];
      const pubkey = await ctx.db.peer.get_pubkey_by_mid(mid_b58);
      if (!pubkey) {
        // throw new Error('invalid mid');
        return false;
      }
      if (
        !(await RSA_verify(
          crypto.keys.unmarshalPublicKey(Buffer.from(pubkey)),
          encode(witness_testimony_cid),
          witness_signatures[i],
        ))
      ) {
        // throw new Error('invalid signature');
        return false;
      }
      if (witness_testimony.prev_block_hash !== prev_block_hash) {
        // throw new Error('previous_block does not match');
        return false;
      }
      if (witness_testimony.action_bundle_cid === action_bundle_cid) {
        ++n_supporter;
      }
    }

    if (n_supporter / n_peer < MIN_ONLINE_RATE) {
      // throw new Error('lack of supporters');
      return false;
    }
  } else {
    const marshal_public_key = crypto.keys.unmarshalPublicKey(
      Buffer.from(b64pad_to_uint8array(ctx.config.bootstrap_public_key)),
    );
    if (
      !(await RSA_verify(
        marshal_public_key,
        encode(witness_testimony_cid),
        witness_signatures[0],
      ))
    ) {
      // throw new Error('invalid signature');
      return false;
    }
    if (witness_testimony.prev_block_hash !== prev_block_hash) {
      // throw new Error('previous_block does not match');
      return false;
    }
  }
  */
  return true;
}

export async function apply_block(
  ctx: Context,
  block: DBBlock,
  rbc_proofs: RBCProof[],
  aba_proofs: ABAProof[],
) {
  await sub_transation(ctx.datasource.options, async (manager) => {
    await block_store.add_block(manager, block);
    for (const i of rbc_proofs) {
      for (const j of i.signatures) {
        const rbc_ready_msg: RBCReadyMessage = {
          epoch: block.epoch,
          stage: RBCProtocolStage.RBC_READY,
          root_block_cid: ctx.root_block_cid,
          sender: j.signatory,
          provider: i.node_id,
          cid: i.cid,
        }
        await rbc_store.set_ready(
          manager,
          rbc_ready_msg,
          Buffer.from(j.signature),
        );
      }
      await rbc_store.set_resolved(manager, ctx.root_block_cid, block.epoch, i.node_id, i.cid);
    }
    for (const i of aba_proofs) {
      await aba_store.set_current_info(manager, {
        root_block_cid: ctx.root_block_cid,
        epoch: block.epoch,
        session_id: i.node_id,
        round: i.round,
        stage: ABAProtocolStage.ABA_DECIDED,
        val: i.val ? ABAValue.true : ABAValue.false,
      });
      for (const j of i.signatures) {
        await aba_store.set_final_vote(
          manager,
          {
            root_block_cid: ctx.root_block_cid,
            epoch: block.epoch,
            sender: j.signatory,
            round: i.round,
            session_id: i.node_id,
            val: i.val ? ABAValue.true : ABAValue.false,
            stage: ABAProtocolStage.ABA_FINALVOTE,
          },
          j.signature,
        );
      }
    }
  });
}

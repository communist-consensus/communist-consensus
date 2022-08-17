import { MIN_ONLINE_RATE } from '../../shared/constant';
import crypto from 'libp2p-crypto';
import {
  ActionBundle,
  ActionSubjects,
  BlockchainBlock,
  Context,
  IPFSAddress,
  Witnesses,
  WitnessSignature,
  WitnessSignatures,
  WitnessTestimony,
} from '../../shared/types';
import {
  decode,
  encode,
  pubkey_str_to_uint8array,
  RSA_verify,
} from '../../shared/utils';
import apply_actions from './apply_actions';

export async function verify_block(
  ctx: Context,
  block: BlockchainBlock,
  witness_signatures_cid: IPFSAddress,
  witnesses_cid: IPFSAddress,
  witness_testimony_cid: IPFSAddress,
  witness_testimony: WitnessTestimony,
) {
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
      Buffer.from(pubkey_str_to_uint8array(ctx.config.bootstrap_public_key)),
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
  return true;
}

export async function apply_block(ctx: Context, block: BlockchainBlock) {
  const {
    prev_block_hash,
    action_bundle_cid,
    action_subjects_cid,
    actions_broadcast_window_start,
    witness_broadcast_window_end,
  } = block;

  const action_bundle = await ctx.ipfs.get<ActionBundle>(action_bundle_cid);
  const action_subjects = await ctx.ipfs.get<ActionSubjects>(
    action_subjects_cid,
  );

  await apply_actions(
    ctx,
    action_bundle,
    action_subjects,
    actions_broadcast_window_start,
    witness_broadcast_window_end,
    prev_block_hash,
  );
}

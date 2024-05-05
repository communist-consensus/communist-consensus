import sha from 'multihashing-async/src/sha.js';
import * as Digest from 'multiformats/hashes/digest'
import { createPeerId, peerIdFromKeys } from '@libp2p/peer-id';
import { createEd25519PeerId, createFromJSON } from '@libp2p/peer-id-factory';
import { identity } from 'multiformats/hashes/identity';
import { base58btc } from 'multiformats/bases/base58';
import sha256 from 'crypto-js/sha256.js';
import {
  IKBucket,
  PublicKey,
  PrivateKey,
  ConsensusConfig,
  MassActions,
  IPFSAddress,
  DBBlock,
} from '../types';
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { MIN_TIME_ERROR, MIN_TRANSMISSION_DURATION } from '../constant';
export * from './priority-queue';
import { Buffer } from 'buffer';
import { unmarshalPrivateKey, unmarshalPublicKey } from '@libp2p/crypto/keys';

export async function verify_cid(bytes: Uint8Array, cid: string) {
  try {
    await Block.create({ bytes: bytes, cid: CID.parse(cid), codec, hasher });
  } catch (e) {
    return false;
  }
  return true;
}

export async function get_block<T>(obj: T) {
  return (await Block.encode({ value: obj, codec, hasher }));
}
export async function get_cid_str<T>(obj: T) {
  return (await Block.encode({ value: obj, codec, hasher })).cid.toString();
}

export async function get_cid<T>(obj: T) {
  return (await Block.encode({ value: obj, codec, hasher })).cid;
}

export async function encode<T>(obj: T) {
  return (await Block.encode({ value: obj, codec, hasher })).bytes;
}

export async function decode<T>(bytes) {
  return (await Block.decode({ bytes: bytes, codec, hasher })).value as T;
}

export async function pubkey_to_node_id(pubkey: Uint8Array) {
  return await uint8array_to_b58(Digest.create(0, pubkey).bytes);
  // return uint8array_to_b58(await sha.multihashing(pubkey, 'sha2-256'));
}

export function b64pad_to_uint8array(str) {
  return uint8ArrayFromString(str, 'base64pad');
}

export function utf8_to_uint8array(s: string) {
  return uint8ArrayFromString(s, 'utf8');
}

export function uint8array_to_utf8(s: Uint8Array) {
  return uint8ArrayToString(s, 'utf8');
}

export function uint8array_to_b58(s: Uint8Array) {
  return uint8ArrayToString(s, 'base58btc');
}

export function b58_to_uint8array(s: string) {
  return uint8ArrayFromString(s, 'base58btc');
}

export function b64_to_uint8array(s: string) {
  return uint8ArrayFromString(s, 'base64');
}

export function uint8array_to_b64(s: Uint8Array) {
  return uint8ArrayToString(s, 'base64');
}

export function uint8array_to_b64pad(s: Uint8Array) {
  return uint8ArrayToString(s, 'base64pad');
}

export function hash(a: any) {
  if (a instanceof Uint8Array) {
    return hash(uint8array_to_b64(a));
  } else if (a instanceof Object) {
    return hash(JSON.stringify(a));
  } else {
    return sha256(`internationale-${a}`).toString();
  }
}

export function hash_signatures(a: Uint8Array[]) {
  return sha256(a).toString();
}

export function seed_random(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280.0;
  };
}

// TODO
export function seed_random_str(seed: string) {
  const seed_num = Uint8Array.from(Buffer.from(seed.substr(0, 20))).reduce(
    (m, i) => (m + (i % 10)) * 10,
    0,
  );
  return seed_random(seed_num);
}

export const random = seed_random(Math.random());

export function gen_id(r = random) {
  return r().toString(16).substr(2);
}

// TODO
export const sleep = (t: number, compensation = 16) =>
  new Promise((res) => setTimeout(res, t + compensation));

export function shuffle<T>(a: T[], seed?: number) {
  const r = seed ? seed_random(seed) : random;
  for (let i = a.length; i > 0; i--) {
    const j = Math.floor(r() * i);
    [a[i - 1], a[j]] = [a[j], a[i - 1]];
  }
  return a;
}

export function shuffle_by_string<T>(
  a: T[],
  seed: string,
) {
  return shuffle(
    a,
    Array.from(seed).reduce((total, i) => i.charCodeAt(0) + total, 0),
  );
}

export function sort_n_array(
  arrays: any[][],
  comparator: (x: any, y: any) => number,
) {
  if (!arrays.length || !arrays[0].length) return arrays;
  const arrayKeys = Object.keys(arrays);
  const sortableArray = Object.values(arrays)[0];
  const indexes = Object.keys(sortableArray);
  const sortedIndexes = indexes.sort((a, b) =>
    comparator(sortableArray[a], sortableArray[b]),
  );

  let sortByIndexes = (array, sortedIndexes) =>
    sortedIndexes.map((sortedIndex) => array[sortedIndex]);

  return arrayKeys.map((arrayIndex) =>
    sortByIndexes(arrays[arrayIndex], sortedIndexes),
  );
}

export function shuffle_n_array(a: any[][], seed) {
  if (!a.length || !a[0].length) return a;
  const c = a[0].map((i, idx) => a.map((j) => j[idx]));
  const s = shuffle(c, seed);
  return s[0].map((j, idx) => s.map((i, idx2) => s[idx2][idx]));
}

export function hash_to_number(str: string) {
  // TODO test
  return Buffer.from(str.substr(0, 32)).readUInt32LE(0);
}

export function array_equals(
  array1: any[] | Uint8Array,
  array2: any[] | Uint8Array,
) {
  if (array1 === array2) {
    return true;
  }
  if (array1.length !== array2.length) {
    return false;
  }
  for (let i = 0, length = array1.length; i < length; ++i) {
    if (array1[i] !== array2[i]) {
      return false;
    }
  }
  return true;
}

export function uint8array_to_int(a: Uint8Array) {
  let x = 0;
  for (let i = 0; i < a.length; ++i) {
    x = (x << 8) + a[i];
  }
  return x;
}

export function common_prefix(a: number, b: number) {
  let x = a ^ b;
  let r = 0;
  while (x) {
    x = x >> 1;
    r = (r << 1) + 1;
  }
  return ~r;
}

export function intersect(a: any[], b: any[]) {
  var setA = new Set(a);
  var setB = new Set(b);
  return [...setA].filter((x) => setB.has(x));
}

export function get_now() {
  return Math.floor(Date.now() / 1000);
}

export function compute_actions_broadcast_duration(
  min_broadcast_window: number,
  n: number,
) {
  // TODO
  const transmission_duration = MIN_TRANSMISSION_DURATION;
  const estimated_time_error = MIN_TIME_ERROR;

  return {
    actions_broadcast_duration:
      Math.floor(Math.max(min_broadcast_window, n / 1000000)) -
      transmission_duration -
      2 * estimated_time_error,
    estimated_transmission_duration: transmission_duration,
    estimated_time_error,
  };
}

export function compute_witness_broadcast_duration(
  min_witness_broadcast_window: number,
  n: number,
  ideal_witness_broadcast_window_start: number, // last_witness_broadcast_window_end
  now = get_now(),
) {
  if (now < ideal_witness_broadcast_window_start) {
    debugger;
    throw new Error('...');
  }
  // TODO
  const transmission_duration = MIN_TRANSMISSION_DURATION;
  const estimated_time_error = MIN_TIME_ERROR;

  const base = Math.floor(Math.max(min_witness_broadcast_window, n / 250000));
  const n_tries =
    now === ideal_witness_broadcast_window_start
      ? 0
      : Math.floor(
          Math.log2(
            Math.floor((now - ideal_witness_broadcast_window_start) / base + 1),
          ),
        );
  const total_duration = base * Math.pow(2, n_tries);
  return {
    n_tries,
    witness_broadcast_window_start:
      ideal_witness_broadcast_window_start + base * (Math.pow(2, n_tries) - 1),
    witness_broadcast_duration:
      total_duration - transmission_duration - 2 * estimated_time_error,
    estimated_transmission_duration: transmission_duration,
    estimated_time_error,
  };
}

// TODO
export function ecdsa_vrfy(
  pk: PublicKey,
  payload: Uint8Array,
  signature: Uint8Array,
) {
  return true;
}
export function ecdsa_sign(sk: PrivateKey, payload: Uint8Array) {
  return new Uint8Array();
}

export async function sign(sk: PrivateKey, payload: Uint8Array) {
  return await (await unmarshalPrivateKey(sk)).sign(payload);
}

export async function verify(
  pk: PublicKey,
  payload: Uint8Array,
  sign: Uint8Array,
) {
  try {
    return await(await unmarshalPublicKey(pk)).verify(payload, sign);
  } catch (e) {
    return false;
  }
}

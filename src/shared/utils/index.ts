import sha from 'multihashing-async/src/sha.js';
import sha256 from 'crypto-js/sha256.js';
import { RSASignature, MID, IKBucket } from '../types';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { RsaPublicKey, RsaPrivateKey } from 'libp2p-crypto/src/keys/rsa-class';
import { MIN_TIME_ERROR, MIN_TRANSMISSION_DURATION } from '../constant';
export * from './priority-queue';
import { Buffer } from 'buffer';

enum EncodeType {
  string,
  number,
  boolean,
  uint8array,
  buffer,
}

function do_decode(x: any) {
  if (x instanceof Array) {
    return x.map(i => do_decode(i));
  } else if (typeof x === 'object') {
    if (Object.keys(x).join('') === 'tv') {
      if (x.t === EncodeType.uint8array) {
        return b64_to_uint8array(x.v);
      } else if (x.t === EncodeType.buffer) {
        return Buffer.from(b64_to_uint8array(x.v));
      } else {
        return x.v;
      }
    } else {
      const m = {};
      Object.keys(x).forEach((i) => (m[i] = do_decode(x[i])));
      return m;
    }
  } 
}

function do_encode(x: any) {
  if (typeof x === 'string') {
    return {
      t: EncodeType.string,
      v: x,
    };
  } else if (x instanceof Array) {
    return x.map(i => do_encode(i));
  } else if (x instanceof Buffer) {
    return {
      t: EncodeType.buffer,
      v: uint8array_to_b64(x),
    }
  } else if (x instanceof Uint8Array) {
    return {
      t: EncodeType.uint8array,
      v: uint8array_to_b64(x),
    }
  } else if (typeof x === 'object') {
    const m = {};
    Object.keys(x).forEach(i => m[i] = do_encode(x[i]));
    return m;
  } else if (typeof x === 'number') {
    return {
      t: EncodeType.number,
      v: x,
    };
  } else if (typeof x === 'boolean') {
    return {
      t: EncodeType.boolean,
      v: x,
    };
  } 
}

export function encode_to_str(obj: any) {
  return JSON.stringify(do_encode(obj));
}

export function encode(obj: any) {
  const str = JSON.stringify(do_encode(obj));
  return Buffer.from(str);
}

export function decode<T>(data: Uint8Array | string) {
  return do_decode(JSON.parse(data.toString())) as T;
}

// 256bytes
export async function RSA_sign(privateKey: RsaPrivateKey, data: Uint8Array) {
  return await privateKey.sign(data);
}

// 0.14 ms
export async function RSA_verify(publicKey: RsaPublicKey, data: Uint8Array, sig: RSASignature): Promise<boolean> {
  return await publicKey.verify(data, sig);
}

export function RSA_encrypt(publicKey: RsaPublicKey, data: Uint8Array) {
  return publicKey.encrypt(data);
}

export function RSA_decrypt(privateKey: RsaPrivateKey, encryptedData: Uint8Array) {
  return privateKey.decrypt(encryptedData);
}

export async function pubkey_to_mid(pubkey: Uint8Array) {
  return uint8array_to_b58(await sha.multihashing(pubkey, 'sha2-256'));
}

export function pubkey_str_to_uint8array(str) {
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
  const seed_num = Uint8Array.from(Buffer.from(seed.substr(0, 20))).reduce((m, i) => (m + i % 10) * 10, 0);
  return seed_random(seed_num);
}

export const random = seed_random(Math.random());

export function gen_id(r = random) {
  return r().toString(16).substr(2);
}

// TODO
export const sleep = (t: number, compensation = 16) => new Promise(res => setTimeout(res, t + compensation));

export function shuffle<T>(a: T[], seed?: number) {
  const r = seed ? seed_random(seed) : random;
  for (let i = a.length; i > 0; i--) {
    const j = Math.floor(r() * i);
    [a[i - 1], a[j]] = [a[j], a[i - 1]];
  }
  return a;
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
  const c = a[0].map((i, idx) => a.map(j => j[idx]));
  const s = shuffle(c, seed);
  return s[0].map((j, idx) => s.map((i, idx2) => s[idx2][idx]));
}

export function hash_to_number(str: string) {
  // TODO test
  return Buffer.from(str.substr(0, 32)).readUInt32LE(0);
}

export function array_equals(array1: any[] | Uint8Array, array2: any[] | Uint8Array) {
  if (array1 === array2) {
    return true
  }
  if (array1.length !== array2.length) {
    return false
  }
  for (let i = 0, length = array1.length; i < length; ++i) {
    if (array1[i] !== array2[i]) {
      return false
    }
  }
  return true
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
  return ~ r;
}

export function uniq(arr: any[]) {
  const s = new Set();
  for (const i of arr) {
    s.add(i);
  }
  const res = [];
  for (const i of s) {
    res.push(i);
  }
  return res;
}

export function intersect(a: any[], b: any[]) {
  var setA = new Set(a);
  var setB = new Set(b);
  return [...setA].filter(x => setB.has(x));
}

export function get_bucket_node(kb: IKBucket, id: Uint8Array) {
  let bitIndex = 0;
  let node = kb.root;
  while (node.contacts === null) {
    node = kb._determineNode(node, id, bitIndex++);
  }
  return node;
}

export function get_common_bucket_node(kb: IKBucket, id_a: Uint8Array, id_b: Uint8Array) {
  let bitIndex = 0;
  let node = kb.root;
  while (true) {
    const a = kb._determineNode(node, id_a, bitIndex + 1);
    const b = kb._determineNode(node, id_b, bitIndex + 1);
    if (a !== b) {
      break;
    }
    if (!a) {
      break;
    }
    node = a;
  }
  return node;
}

export function get_now() {
  return Math.floor((Date.now()) / 1000);
}

export function compute_actions_broadcast_duration(min_broadcast_window: number, n: number) {
  // TODO
  const transmission_duration = MIN_TRANSMISSION_DURATION;
  const estimated_time_error = MIN_TIME_ERROR;

  return {
    actions_broadcast_duration:
      Math.floor(Math.max(min_broadcast_window, n / 1000000)) - transmission_duration - 2 * estimated_time_error,
    estimated_transmission_duration: transmission_duration,
    estimated_time_error,
  };
};

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
            Math.floor(((now - ideal_witness_broadcast_window_start) / base) + 1),
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
};
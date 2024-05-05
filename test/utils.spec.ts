import assert from 'assert';
import { generateKeyPair, marshalPrivateKey, unmarshalPrivateKey, marshalPublicKey, unmarshalPublicKey } from '@libp2p/crypto/keys'
import { peerIdFromKeys } from '@libp2p/peer-id';
// import { Ed25519PrivateKey, Ed25519PublicKey,unmarshalEd25519PrivateKey, unmarshalEd25519PublicKey } from '@libp2p/crypto/keys/ed25519-class';
import { base58btc } from 'multiformats/bases/base58'
import { identity } from 'multiformats/hashes/identity'
import { b58_to_uint8array, b64pad_to_uint8array, decode, encode, get_cid, random, shuffle, shuffle_n_array, sort_n_array, uint8array_to_b58, verify_cid } from '../src/backend/utils';
import { Context } from '../src/backend/types';
import { ActionBundle, Actions, ActionsTestimony, ActionSubjects, ActionType } from '../shared/types';
import config_a from './config/a.local';
import config_b from './config/b.local';
import { createMerkleTree, getMerkleBranch, merkleVerify } from '../shared/utils/merkletree';

describe('utils test', function () {
  it('shuffle', function () {
    const res = shuffle([1, 2, 3, 4, 5], 123);
    const test = [4, 5, 2, 3, 1];
    for (const i in test) {
      assert.strictEqual(test[i] === res[i], true);
    }
  });
  it('shuffle_n_array (h > w)', function () {
    const res = shuffle_n_array(
      [
        [1.1, 2.1, 3.1],
        [1.2, 2.2, 3.2],
        [1.3, 2.3, 3.3],
        [1.4, 2.4, 3.4],
      ],
      123,
    );
    assert.strictEqual(
      '[[3.1,2.1,1.1],[3.2,2.2,1.2],[3.3,2.3,1.3],[3.4,2.4,1.4]]' ===
        JSON.stringify(res),
      true,
    );
  });
  it('shuffle_n_array (w > h)', function () {
    const res = shuffle_n_array(
      [
        [1.1, 2.1, 3.1, 4.1, 5.1],
        [1.2, 2.2, 3.2, 4.2, 5.2],
        [1.3, 2.3, 3.3, 4.3, 5.3],
      ],
      123,
    );
    assert.strictEqual(
      '[[4.1,5.1,2.1,3.1,1.1],[4.2,5.2,2.2,3.2,1.2],[4.3,5.3,2.3,3.3,1.3]]' ===
        JSON.stringify(res),
      true,
    );
  });
  it('sort_n_array (w > h)', function () {
    const res = sort_n_array(
      [
        [1.1, 2.1, 3.1, 4.1, 5.1],
        [1.2, 2.2, 3.2, 4.2, 5.2],
        [1.3, 2.3, 3.3, 4.3, 5.3],
      ],
      (a, b) => b - a,
    );
    assert.strictEqual(
      '[[5.1,4.1,3.1,2.1,1.1],[5.2,4.2,3.2,2.2,1.2],[5.3,4.3,3.3,2.3,1.3]]' ===
        JSON.stringify(res),
      true,
    );
  });
  it('sort_n_array (h > w)', function () {
    const res = sort_n_array(
      [
        [1.1, 3.1, 2.1],
        [1.2, 3.2, 2.2],
        [1.3, 3.3, 2.3],
        [1.4, 3.4, 2.4],
      ],
      (a, b) => b - a,
    );
    assert.strictEqual(
      '[[3.1,2.1,1.1],[3.2,2.2,1.2],[3.3,2.3,1.3],[3.4,2.4,1.4]]' ===
        JSON.stringify(res),
      true,
    );
  });

  it('merkletree', async function () {
    const data = [
      Buffer.from([1, 192, 97, 45, 49]),
      Buffer.from([1, 224, 50, 51, 0]),
    ];
    const mtree = createMerkleTree(data);
    const roothash = mtree[1];
    const branch = getMerkleBranch(0, mtree);
    const branch2 = getMerkleBranch(1, mtree);
    console.log(roothash, branch, branch2);
    assert(merkleVerify(data[0], roothash, branch, 0));
    assert(merkleVerify(data[1], roothash, branch2, 1));
    assert(merkleVerify(data[1], roothash, branch, 1) == false);
  });

  it('coding', async function () {
    const a = { asdf: 123, v: '123', f: Buffer.from('asdf') };
    const a_cid = await get_cid(a);

    const a2 = { v: '123', asdf: 123, f: Buffer.from('asdf') };
    const a2_cid = await get_cid(a2);

    assert.strictEqual(a_cid, a2_cid);

    const b = { v: 's23', asdf: 123, f: Buffer.from('asdf') };
    const b_cid = await get_cid(b);
    assert.strictEqual(a_cid !== b_cid, true);

    const a_buf = await encode(a);
    assert.strictEqual((await decode<any>(a_buf)).v, '123');

    console.log(await verify_cid(a_buf, a_cid), true);
    console.log(await verify_cid(a_buf, b_cid), false);
  });
  it('signature', async function () {
    const a = await peerIdFromKeys(
      b64pad_to_uint8array(config_a.public_key),
      b64pad_to_uint8array(config_a.private_key),
    );
    const b = await peerIdFromKeys(
      b64pad_to_uint8array(config_b.public_key),
      b64pad_to_uint8array(config_b.private_key),
    );

    const obj = { x: 1 };
    const obj2 = { x: 2 };
    const encoded_obj = await encode(obj);
    const encoded_obj2 = await encode(obj2);

    const sk = await unmarshalPrivateKey(a.privateKey);
    const pk = await unmarshalPublicKey(a.publicKey);
    const sk2 = await unmarshalPrivateKey(b.privateKey);
    const pk2 = await unmarshalPublicKey(b.publicKey);
    const sign = await sk.sign(encoded_obj);
    const sign2 = await sk2.sign(encoded_obj2);

    assert.strictEqual(await pk.verify(encoded_obj, sign), true);
    assert.strictEqual(await pk.verify(encoded_obj2, sign), false);
    assert.strictEqual(await pk.verify(encoded_obj, sign2), false);
    assert.strictEqual(await pk2.verify(encoded_obj, sign2), false);
    assert.strictEqual(await pk2.verify(encoded_obj, sign), false);
  });
});

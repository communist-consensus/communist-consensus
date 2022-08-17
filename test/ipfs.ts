import IPFS from '../src/backend/ipfs';
import assert from 'assert';

describe('ipfs', function() {
  it('ipfs', async function() {
    const ipfs = await IPFS.create();
    let res;
    let test;
    test = 'test';
    res = await ipfs.get(await ipfs.add(test));
    assert.strictEqual(res, test);
    test = [
      'xx',
      123,
      true,
      false,
      {
        a: 'xx',
        b: 123,
        c: true,
        d: false,
        e: [1, 2, 3],
      },
      [1, 2, 3],
    ];
    res = await ipfs.get(await ipfs.add(test));
    assert.strictEqual(JSON.stringify(res), JSON.stringify(test));
    test = {
      a: 'xx',
      b: 123,
      c: true,
      d: false,
      e: [1, 2, 3],
      ss: ['xx', 123, true, false],
    };
    res = await ipfs.get(await ipfs.add(test));
    assert.strictEqual(JSON.stringify(res), JSON.stringify(test));
    test = {
      ss: ['xx', Buffer.from('123'), new Uint8Array(Buffer.from('234'))],
    };
    res = await ipfs.get(await ipfs.add(test));
    console.log(res.ss[1], res.ss[2]);
    assert.strictEqual(res.ss[1] instanceof Buffer, true);
    assert.strictEqual(!(res.ss[2] instanceof Buffer) && (res.ss[2] instanceof Uint8Array), true);
    assert.strictEqual(res.ss[1].toString(), test.ss[1].toString());
    assert.strictEqual(res.ss[2].toString(), test.ss[2].toString());
    await ipfs.stop();
  });
});
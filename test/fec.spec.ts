import assert from 'assert';
import createErasureCoding from '../src/backend/bft/erasure-coding';
describe('fec', function() {
  it('erasure-coding-success', async function () {
    const N = 10;
    const f = 3;
    const erasure_coding = await createErasureCoding(N, f);
    const origin = Uint8Array.from([1, 2, 3]);
    const parts = erasure_coding.encode(origin);

    const decoded = erasure_coding.decode([
      parts[0],
      parts[8],
      parts[7],
      parts[3],
      parts[2],
      parts[5],
      parts[6],
    ]);
    assert.strictEqual(decoded.toString(), origin.toString());
  });
  it('erasure-coding-failed', async function () {
    const N = 10;
    const f = 3;
    const erasure_coding = await createErasureCoding(N, f);
    const origin = Uint8Array.from([1, 2, 3]);
    const parts = erasure_coding.encode(origin);

    let flag = false;
    try {
      const decoded = erasure_coding.decode([
        parts[0],
        parts[8],
        parts[3],
        parts[2],
        parts[5],
        parts[6],
      ]);
    } catch (e) {
      flag = true;
    }
    expect(flag).toEqual(true);
  });
  it('erasure-coding-failed2', async function () {
    const N = 10;
    const f = 3;
    const erasure_coding = await createErasureCoding(N, f);
    const origin = Uint8Array.from([1, 2, 3]);
    const parts = erasure_coding.encode(origin);

    const decoded = erasure_coding.decode([
      parts[0],
      parts[8],
      parts[8],
      parts[9],
      parts[2],
      parts[5],
      parts[6],
    ]);
    expect(decoded.toString() !== origin.toString()).toEqual(true);
  });
});
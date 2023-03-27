import fec from '../../../shared/utils/fec.cjs';

/**
 * Protential weakness: attackers may recover partial of the message.
 */
export default function createErasureCoding(
  N: number,
  f: number,
): {
  encode: (msg: Uint8Array) => Uint8Array[];
  decode: (shards: Uint8Array[]) => Uint8Array;
} {
  const e = fec.fec(N - f, N);
  return {
    encode: (msg: Uint8Array) => e.encode(msg),
    decode: (parts: Uint8Array[]) => e.decode(parts),
  };
}

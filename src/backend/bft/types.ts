export type PublicKey = any;
export type PrivateKey = any;

export type Input = any;
export type NodeIndex = number;
export type NodeID = string;

/*
:param str sid: The base name of the common coin that will be used to
derive a nonce to uniquely identify the coin.
:param int pid: Node id.
:param int B: Batch size of transactions.
:param int N: Number of nodes in the network.
:param int f: Number of faulty nodes that can be tolerated.
:param TBLSPublicKey sPK: Public key of the (f, N) threshold signature
(:math:`\mathsf{TSIG}`) scheme.
:param TBLSPrivateKey sSK: Signing key of the (f, N) threshold signature
(:math:`\mathsf{TSIG}`) scheme.
:param TBLSPublicKey sPK1: Public key of the (N-f, N) threshold signature
(:math:`\mathsf{TSIG}`) scheme.
:param TBLSPrivateKey sSK1: Signing key of the (N-f, N) threshold signature
(:math:`\mathsf{TSIG}`) scheme.
:param list sPK2s: Public key(s) of ECDSA signature for all N parties.
:param PrivateKey sSK2: Signing key of ECDSA signature.
:param str ePK: Public key of the threshold encryption
(:math:`\mathsf{TPKE}`) scheme.
:param str eSK: Signing key of the threshold encryption
(:math:`\mathsf{TPKE}`) scheme.
*/
export type Context = {
  sid: string;
  pid: number;
  B: number;
  N: number;
  f: number;
  sPk: PublicKey;
  sSK: PrivateKey;
  sPk1: PublicKey;
  sSK1: PrivateKey;
  sPk2: PublicKey;
  sSK2: PrivateKey;
  ePk: PublicKey;
  eSK: PrivateKey;
};
export type PublicKey = any;
export type PrivateKey = any;

export type Input = any;
export type NodeIndex = number;
export type NodeID = string;

export type Context = {
  sid: string; // The base name of the common coin that will be used to derive a nonce to uniquely identify the coin.
  // session id
  pid: number; // Node id.
  B: number; // Batch size of transactions.
  N: number; // Number of nodes in the network.
  f: number; // Number of faulty nodes that can be tolerated.
  sPk: PublicKey; // TBLSPublicKey sPK: Public key of the (f, N) threshold signature.
  sSK: PrivateKey; // TBLSPrivateKey sSK: Signing key of the (f, N) threshold signature.
  sPk1: PublicKey; // Public key of the (N-f, N) threshold signature.
  sSK1: PrivateKey; // Signing key of the (N-f, N) threshold signature.
  sPk2: PublicKey; // Public key(s) of ECDSA signature for all N parties.
  sSK2: PrivateKey; // Signing key of ECDSA signature.
  ePk: PublicKey; // Public key of the threshold encryption.
  eSK: PrivateKey; // Signing key of the threshold encryption.
  PK2s: PublicKey[]; // list PK2s: an array of ``coincurve.PublicKey'', i.e., N public keys of ECDSA for all parties
  SK2s: PublicKey[]; // PublicKey SK2: ``coincurve.PrivateKey'', i.e., secret key of ECDSA
};

export type PRBCOutputs = Map<NodeIndex, Uint8Array>;
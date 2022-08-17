import EventEmitter from 'node:events';

/*
    :param sid: session identifier
    :param pid: my id number
    :param N: the number of parties
    :param f: the number of byzantine parties
    :param PK: ``boldyreva.TBLSPublicKey`` with threshold f+1
    :param SK: ``boldyreva.TBLSPrivateKey`` with threshold f+1
    :param PK1: ``boldyreva.TBLSPublicKey`` with threshold n-f
    :param SK1: ``boldyreva.TBLSPrivateKey`` with threshold n-f
    :param list PK2s: an array of ``coincurve.PublicKey'', i.e., N public keys of ECDSA for all parties
    :param PublicKey SK2: ``coincurve.PrivateKey'', i.e., secret key of ECDSA
    */
export class ValidatedAgreement extends EventEmitter {
  constructor({
    sid,
    pid,
    N,
    f,
    PK,
    SK,
    PK1,
    SK1,
    PK2s,
    SK2,
    input,
  }: {
    sid: string;
    pid: number;
    N: number;
    f: number;
    PK: PublicKey;
    SK: PrivateKey;
    PK1: PublicKey;
    SK1: PrivateKey;
    PK2s: PublicKey[];
    SK2: PrivateKey;
    input: any;
  }) {
    super();
  }
  async start() {
    const values = new Map<Sender, any>();
    await new Promise<void>((resolve) => {
      const listener = () => (sender, value) => {
        values.set(sender, value);
        if (values.size >= N - f) {
            this.off(`VABA_CBC`, listener);
            resolve();
        }
      };
      this.on(`VABA_CBC`, listener)
    });

    
  }
}
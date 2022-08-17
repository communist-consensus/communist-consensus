import EventEmitter from 'node:events';
import { Context, Input, NodeIndex } from './types';

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
    :param input: ``input()`` is called to receive an input
    :param decide: ``decide()`` is eventually called
    :param receive: receive channel
    :param send: send channel
    :param predicate: ``predicate(i, v)`` represents the externally validated condition where i represent proposer's pid
    */
export class ValidatedCommonSubset extends EventEmitter {
  ctx: Context;
  input: Input;
  constructor(ctx: Context, input: Input) {
    super();
    this.ctx = ctx;
    this.input = input;
  }
  async start() {
    const values = new Map<NodeIndex, any>();
    const { N, f } = this.ctx;
    await new Promise<void>((resolve) => {
      const listener = () => (sender, value) => {
        values.set(sender, value);
        if (values.size >= N - f) {
            this.off(`VACS_VAL`, listener);
            resolve();
        }
      };
      this.on(`VACS_VAL`, listener)
    });

    
  }
}
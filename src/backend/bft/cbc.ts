import EventEmitter from 'node:events';
import { Context, NodeID, NodeIndex } from './types';

/**
 * 广播x，保证x被多数人接收，多数人知道x被多数人确认
 */
export class ConsistentBroadcast extends EventEmitter {
  ctx: Context;
  constructor(ctx: Context) {
    super();
    this.ctx = ctx;
  }
  send() {
  }
  async start() {
    const values = new Map<NodeID, any>();
    this.send('CBC_SEND', ecdsa_sign(SK2, input));
    await new Promise<void>((resolve) => {
      const listener = () => (sender, value) => {
        this.send('CBC_ECHO', ecdsa_sign(value));
        values.set(sender, value);
        if (values.size >= N - f) {
            this.off(`CBC_SEND`, listener);
            resolve();
        }
      };
      this.on(`CBC_SEND`, listener)
    });

    
  }
}
import { EventEmitter } from 'events';
import IP from 'ip';
import { INetworkDetect } from './types';

export default class NetworkDetect extends EventEmitter implements INetworkDetect {
  address: string = IP.address();
  constructor(interval: number) {
    super();
    setInterval(() => {
      const new_address = IP.address();
      if (new_address !== this.address) {
        this.emit('addressChange', new_address, this.address);
        this.address = new_address;
      }
    }, interval);
  }
  static async create(interval = 10 * 1000) {
    const nd = new NetworkDetect(interval);
    return nd;
  }
}
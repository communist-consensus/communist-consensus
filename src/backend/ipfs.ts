import * as IPFS_CORE from 'ipfs-core';
import { GetOptions } from 'ipfs-core-types/src/root';
import { extract } from 'it-tar';
import all from 'it-all';
import pipe from 'it-pipe';
import { IIPFS } from './types';
import { decode, encode, sleep } from '../shared/utils';

export default class IPFS implements IIPFS {

  ipfs_core: IPFS_CORE.IPFS;

  static async create() {
    const ipfs = new IPFS();
    await ipfs.init();
    return ipfs;
  }

  async init() {
    while (true) {
      try {
        this.ipfs_core = await IPFS_CORE.create();
        break;
      } catch (e) {
        console.log(e);
        await sleep(1000);
      }
    }
    await this.start();
  }

  async add(data: any) {
    const { cid } = await this.ipfs_core.add(encode(data));
    return cid.toString();
  }

  async get<T>(cid): Promise<T> {
    // return await pipe(this.ipfs_core.get(cid, options), extract);
    const list: Uint8Array[] = [];
    for await (const b of this.ipfs_core.cat(cid)) {
      list.push(b);
    }
    return decode((Buffer.concat(list)).toString());
  }

  async get_cid(data: Uint8Array | string) {
    const { cid } = await this.ipfs_core.add(data, { onlyHash: true, pin: false });
    return cid.toString();
  }

  async stop() {
    await this.ipfs_core.stop();
  }

  async start() {
    try {
      await this.ipfs_core.start();
    } catch (e) {}
  }
}
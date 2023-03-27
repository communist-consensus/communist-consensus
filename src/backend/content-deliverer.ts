import type { Libp2p } from 'libp2p';
import { IContentDeliverer } from './types';
import { get_cid } from './utils';

const tmp = {};
export default async function createContentDeliverer(libp2p: Libp2p): Promise<IContentDeliverer> {
  return {
    // TODO
    get: async <T>(cid) => {
      return tmp[cid] as T;
    },
    provide: async (obj) => {
      const cid = await get_cid(obj);
      tmp[cid] = obj;
      return cid;
    },
  };
}
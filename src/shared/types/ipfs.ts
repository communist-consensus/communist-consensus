import { GetOptions } from 'ipfs-core-types/src/root';

export interface IIPFS {
  get_cid: (data: Uint8Array | string) => Promise<string>;
  get: <T>(cid, options?: GetOptions) => Promise<T>;
  add: (data: any) => Promise<string>;
  stop: () => Promise<void>;
  start: () => Promise<void>;
}
import {
  KeyQuery,
  Query,
  Pair,
  Datastore,
  Options,
  Key,
} from 'interface-datastore';
import { AwaitIterable } from 'interface-store';
import { Connection, createConnection } from 'typeorm';
import map from 'it-map';

import KV from '../database/entity/kv';
import { K_BUCKET_CACHE_SIZE } from '../../../shared/constant';

import debug from 'debug';
import { b64pad_to_uint8array, uint8array_to_b64pad } from '../utils';
const log = debug('blockchain-datastore');

enum BatchOP {
  put,
  delete,
}

const createDataStore = (connection: Connection): Datastore => {
  async function put(key: Key, val: Uint8Array, options?: Options) {
    const kv = new KV();
    kv.key = key.toString();
    kv.value = uint8array_to_b64pad(val);
    kv.name = key.name();
    const namespaces = key.namespaces();
    kv.prefix = `/${namespaces.slice(0, namespaces.length - 1).join('/')}`;
    log('put', kv);
    await connection.getRepository(KV).save(kv);
  }
  async function get(key: Key, options?: Options) {
    const v = await connection.manager.findOne(KV, {
      key: key.toString(),
    });
    if (v) {
      return b64pad_to_uint8array(v.value);
    }
    return new Uint8Array();
  }
  async function del(key: Key, options?: Options) {
    const repo = connection.getRepository(KV);
    log('delete', key.toString());
    const v = await repo.findOne({ key: key.toString() });
    if (v) {
      await repo.remove(v);
    }
  }
  return {
    async open() {},

    async close() {},

    put,

    get,

    async has(key: Key, options?: Options) {
      const v = await connection
        .getRepository(KV)
        .findOne({ key: key.toString() });
      return !!v;
    },

    delete: del,

    batch() {
      const op: [BatchOP, Key, Uint8Array?][] = [];
      return {
        put: (k: Key, v) => op.push([BatchOP.put, k, v]),
        delete: (key: Key) => op.push([BatchOP.delete, key]),
        commit: async () => {
          const q = [];
          while (op.length) {
            const [type, k, v] = op.pop();
            if (type === BatchOP.delete) {
              q.push(del(k));
            } else if (type === BatchOP.put) {
              q.push(put(k, v));
            }
          }
          await Promise.all(q);
        },
      };
    },

    async *query(q: Query, options?: Options) {
      let offset = 0;
      while (true) {
        const f = (
          await connection.getRepository(KV).find({
            where: { prefix: q.prefix },
            skip: offset,
            take: 1,
          })
        )[0];
        if (!f) {
          return;
        }
        ++offset;
        yield f as any;
      }
    },

    async *queryKeys(query: KeyQuery, options?: Options) {
      throw Error('not implemented');
    },

    async *putMany(list: { key: Key; value: any }[], option) {
      for (const { key, value } of list) {
        await put(key, value, option);
      }
    },

    async *getMany(list: Key[], option) {
      for (const key of list) {
        await get(key, option);
      }
    },

    async *deleteMany(list: Key[], option) {
      for (const key of list) {
        await del(key, option);
      }
    },
  };
};
export default createDataStore;

import {
  KeyQuery,
  Query,
  Pair,
  Datastore,
  Key,
} from 'interface-datastore';
import {
  AwaitIterable,
  Options,
} from 'interface-store';
import { Connection, EntityManager, QueryRunner, createConnection } from 'typeorm';
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

const createDataStore = (manager: EntityManager): Datastore => {
  async function put(key: Key, val: Uint8Array, options?: Options) {
    const namespaces = key.namespaces();
    // log('put', kv);
    await manager.upsert(
      KV,
      {
        key: key.toString(),
        value: uint8array_to_b64pad(val),
        name: key.name(),
        prefix: `/${namespaces.slice(0, namespaces.length - 1).join('/')}`,
      },
      ['key'],
    );
    return key;
  }
  async function get(key: Key, options?: Options) {
    const v = await manager.findOne(KV, {
      where: {
        key: key.toString(),
      },
    });
    if (v) {
      return b64pad_to_uint8array(v.value);
    }
    return new Uint8Array();
  }
  async function del(key: Key, options?: Options) {
    log('delete', key.toString());
    const v = await manager.findOne(KV, { where: { key: key.toString() } });
    if (v) {
      await manager.remove(v);
    }
  }
  return {
    put,

    get,

    async has(key: Key, options?: Options) {
      const v = await manager
        .findOne(KV, { where: { key: key.toString() } });
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
          await manager.find(KV, {
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

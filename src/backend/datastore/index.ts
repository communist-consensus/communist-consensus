import { KeyQuery, Query, Pair, Datastore, Options, Key } from 'interface-datastore';
import { AwaitIterable } from 'interface-store';
import { Connection, createConnection } from 'typeorm';
import filter from 'it-filter';
import map from 'it-map';
import take from 'it-take';

import KV from '../database/entity/kv';
import { K_BUCKET_CACHE_SIZE } from '../../shared/constant';

import debug from 'debug';
const log = debug('blockchain-datastore');

enum BatchOP {
  put,
  delete,
}

export default class RIDatastore implements Datastore {

  connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async open() {}

  async close() {}

  async put(key: Key, val: Uint8Array, options?: Options) {
    const kv = new KV();
    kv.key = key.toString();
    kv.value = val;
    kv.name = key.name();
    const namespaces = key.namespaces();
    kv.prefix = `/${namespaces.slice(0, namespaces.length - 1).join('/')}`;
    log('put', kv);
    await this.connection.getRepository(KV).save(kv);
  }

  async get(key: Key, options?: Options) {
    const v = await this.connection.manager.findOne(KV, { key: key.toString() });
    if (v) {
      return v.value;
    }
  }

  async has(key: Key, options?: Options) {
    const v = await this.connection.getRepository(KV).findOne({ key: key.toString() });
    return !!v;
  }

  async delete(key: Key, options?: Options) {
    const repo = this.connection.getRepository(KV);
    log('delete', key.toString());
    const v = await repo.findOne({ key: key.toString() });
    if (v) {
      await repo.remove(v);
    }
  }

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
            q.push(this.delete(k));
          } else if (type === BatchOP.put) {
            q.push(this.put(k, v));
          }
        }
        await Promise.all(q);
      },
    }
  }

  async * query(q: Query, options?: Options) {
    let offset = 0;
    while (true) {
      const f = (
        await this.connection.getRepository(KV).find({
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
  }

  async * queryKeys(query: KeyQuery, options?: Options) {
    throw Error('not implemented');
  }

  async * putMany(list: {key: Key, value: any}[], option) {
    for (const {key, value} of list) {
      await this.put(key, value, option);
    }
  }

  async * getMany(list: Key[], option) {
    for (const key of list) {
      await this.get(key, option);
    }
  }

  async * deleteMany(list: Key[], option) {
    for (const key of list) {
      await this.delete(key, option);
    }
  }
}

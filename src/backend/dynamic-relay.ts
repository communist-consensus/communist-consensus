import { collect, consume } from 'streaming-iterables';
import { pipe } from 'it-pipe';
import { stop } from 'libp2p/src/circuit/circuit/stop.js';

import Libp2p from 'libp2p';
import { shuffle } from './utils';
import { Multiaddr } from 'multiaddr';
import { uniq, sleep } from '../shared/utils';
import AddressChecker from './address-checker';
import debug from 'debug';
import NetworkDetect from './network-detect';
import { RILibp2p, IDynamicRelay } from './types';

const log = debug('dynamic-relay');

async function get_random_open_connections(libp2p: RILibp2p, n = 1, ignored_connections?) {
  const connected_peers = shuffle([
    ...libp2p.connectionManager.connections.keys(),
  ]);
  let res: {
    connection: Libp2p.Connection,
    peer_id: string,
  }[] = [];
  for (let p_id of connected_peers) {
    const open_connections = libp2p.connectionManager.connections.get(p_id).filter(connection => {
      const is_open = connection.stat.status === 'open';
      return ignored_connections ? (ignored_connections.indexOf(connection) === -1 && is_open) : is_open;
    });
    if (open_connections.length) {
      res.push({
        connection: shuffle(open_connections)[0],
        peer_id: p_id,
      });
      if (res.length === n) {
        return res;
      }
    }
  }
  return res;
}

enum DynamicRelayError {
  NO_DIALABLE_MADDRS = 'NO_DIALABLE_MADDRS',
  NO_OPEN_CONNECTION = 'NO_OPEN_CONNECTION',
  ADDRS_EMPTY = 'ADDRS_EMPTY',
  IS_RUNNING = 'IS_RUNNING',
}

export default class DynamicRelay implements IDynamicRelay {
  is_running = false;
  libp2p: RILibp2p;
  is_relay = false;
  idle_timer;
  retry_delay = 30 * 1000;
  idle_timeout = 2 * 60 * 60 * 1000; // 2 hours
  dial_timeout = 30 * 1000;

  constructor(libp2p: RILibp2p, option: { idle_timeout?: number, retry_delay?: number, dial_timeout?: number } = {}) {
    this.libp2p = libp2p;
    this.idle_timeout = option.idle_timeout || this.idle_timeout;
    this.retry_delay = option.retry_delay || this.retry_delay;
    this.dial_timeout = option.dial_timeout || this.dial_timeout;
  }

  static get_protocol_str(libp2p: RILibp2p) {
    return `/${libp2p._config.protocolPrefix}/redial/1.0.0`;
  }

  static async create(libp2p: RILibp2p, option: { idle_timeout?: number, retry_delay?: number, dial_timeout?: number } = {}) {
    const dr = new DynamicRelay(libp2p, option);
    dr.mount();
    return dr;
  }

  // 当一段时间内没有主动连接的节点时, update
  reset_idle_timer() {
    clearTimeout(this.idle_timer);
    this.idle_timer = setTimeout(() => {
      log('idle timeout');
      this.update();
      this.reset_idle_timer();
    }, this.idle_timeout);
  }

  start_timer() {
    this.libp2p.network_detect.on('addressChange', () => {
      this.update();
    });
    this.reset_idle_timer();
    this.libp2p.connectionManager.on('peer:connect', () => {
      this.reset_idle_timer();
    });
  }

  mount() {
    this.libp2p.handle(
      DynamicRelay.get_protocol_str(this.libp2p),
      async ({ connection, stream }) => {
        const [addr_raw] = await pipe(stream, collect);
        const maddr = new Multiaddr(addr_raw._bufs[0]);
        const remote_peer_b58 = connection.remotePeer.toB58String();
        log('receive', remote_peer_b58, maddr.toString());
        // 断开连接
        await this.libp2p.hangUp(connection.remotePeer);
        log('closed', connection.remotePeer.id);
        // 使用这个地址重新连接
        const dialTarget = {
          id: remote_peer_b58,
          addrs: [maddr.protoNames().indexOf('p2p') >= 0 ? maddr : maddr.encapsulate(`/p2p/${remote_peer_b58}`)],
        };
        log('dial target', dialTarget);
        const dialer = this.libp2p.dialer;
        const pendingDial =
          dialer._pendingDials.get(dialTarget.id) ||
          (dialer as any)._createPendingDial(dialTarget, {});
        try {
          const new_connection = await pendingDial.promise;
          log('dial succeeded to %s', dialTarget.id);
        } catch (err) {
          log('dial failed', err, dialTarget);
        } finally {
          pendingDial.destroy();
        }
      },
    );
  }
  async do_update(session_log) {
    // 尝试连接 Relay
    // TODO DHT put 鉴权
    session_log('listenOnAvailableHopRelays');
    (this.libp2p.relay._autoRelay as any)._listenOnAvailableHopRelays();

    // 获取 IP
    const max_n_connection = 5;
    session_log('get random open connection');
    const connection_pairs = await get_random_open_connections(
      this.libp2p,
      max_n_connection,
    );
    if (!connection_pairs.length) {
      throw new Error(DynamicRelayError.NO_OPEN_CONNECTION);
    }
    session_log('open connections', connection_pairs);
    const res_addr = await this.libp2p.address_checker.check({
      connection: connection_pairs[0].connection,
    });
    const addrs = uniq(
      shuffle([
        res_addr,
        ...this.libp2p.addressManager.getListenAddrs(),
        ...this.libp2p.addressManager.getObservedAddrs(),
      ])
        .map((i) => i.toString())
        .filter(
          // 去除通配地址，代理地址
          (i) =>
            i.indexOf('/p2p-circuit') === -1 &&
            i.indexOf('/ip4/0.0.0.0/') === -1 &&
            !i.startsWith('/p2p/') &&
            i.indexOf('/ip6/::/') === -1,
        )
        .map((i) => i.replace(`/p2p/${this.libp2p.peerId.toB58String()}`, '')),
    ).map((i) => new Multiaddr(i));
    session_log(
      'my addrs',
      res_addr,
      this.libp2p.addressManager.getListenAddrs(),
      this.libp2p.addressManager.getObservedAddrs(),
      addrs.map((i) => i.toString()),
    );

    // 选择另几个已连接的节点，让它们断开并主动连接本节点（通过上面的IP）
    // 这些节点有一定概率通过其他 multiaddr 连接到本节点，副作用可忽略不计
    if (!addrs.length) {
      throw new Error(DynamicRelayError.ADDRS_EMPTY);
    }
    if (connection_pairs.length < addrs.length) {
      log('warning: no enough open connections, use partial addrs', connection_pairs.length, addrs.length);
      while (addrs.length > connection_pairs.length) {
        addrs.pop();
      }
    }
    const queue: Promise<Multiaddr>[] = [];
    let n_connected = 0;
    for (const pair of connection_pairs) {
      queue.push(
        new Promise<Multiaddr>(async (resolve) => {
          let timer;
          const addr = addrs.pop();
          if (!addr) {
            resolve(undefined);
            return;
          }
          const fn = async (connection: Libp2p.Connection) => {
            if (connection.remotePeer.toB58String() === pair.peer_id && connection.localAddr.toString() === addr.toString()) {
              clearTimeout(timer);
              session_log(
                `reconnected ${++n_connected}/${connection_pairs.length}`,
                pair.peer_id,
              );
              this.libp2p.connectionManager.off('peer:connect', fn);
              resolve(addr);
            }
          };
          try {
            // TODO timeout cancel
            const { stream } = await pair.connection.newStream(
              DynamicRelay.get_protocol_str(this.libp2p),
            );
            timer = setTimeout(() => {
              session_log('timeout', pair.peer_id);
              this.libp2p.connectionManager.off('peer:connect', fn);
              resolve(undefined);
            }, this.dial_timeout);
            this.libp2p.connectionManager.on('peer:connect', fn);
            session_log('send', pair.peer_id, addr.toString());
            // TODO timeout cancel
            await pipe([addr.bytes], stream, consume);
          } catch (e) {
            session_log('stream error', e);
            resolve(undefined);
          }
        }),
      );
    }
    const dialable_maddrs = (await Promise.all(queue)).filter((i) => i);
    if (!dialable_maddrs.length) {
      throw new Error(DynamicRelayError.NO_DIALABLE_MADDRS);
    }

    // 断开所有relay
    session_log('close relays');
    for (const p_id of (this.libp2p.relay._autoRelay as any)._listenRelays) {
      const open_connections = this.libp2p.connectionManager.connections
        .get(p_id)
        .filter((connection) => connection.stat.status === 'open');
      session_log('close relay', open_connections, p_id);
      for (const connection of open_connections) {
        await stop({
          connection,
          request: {
            dstPeer: {
              id: new Uint8Array(),
              addrs: [],
            },
            srcPeer: {
              id: new Uint8Array(),
              addrs: [],
            },
          },
        });
      }
    }

    session_log(
      'advertise relay',
      dialable_maddrs.map((i) => i.toString()),
    );
    // TODO 清理不能访问的地址
    this.libp2p._config.relay.hop.enabled = true;
    for (const addr of dialable_maddrs) {
      this.libp2p.addressManager.addObservedAddr(addr.toString());
    }
    await this.libp2p.relay._advertiseService();
    session_log('advertise done');
  }

  async update() {
    if (this.is_running) {
      return;
    }
    while (true) {
      const session_log = debug('dynamic-relay:' + Date.now());
      try {
        this.is_running = true;
        await this.do_update(session_log);
        this.is_running = false;
        this.is_relay = true;
        break;
      } catch (e) {
        if (e.message === DynamicRelayError.NO_DIALABLE_MADDRS) {
          session_log('hole punching failed, use relay instead');
          this.libp2p._config.relay.hop.enabled = false;
          this.is_relay = false;
          (this.libp2p.relay._autoRelay as any)._listenOnAvailableHopRelays();
          // TODO advertise observed addr, connection via relay
          this.is_running = false;
          break;
        } else {
          session_log(e);
          session_log(`retry after ${this.retry_delay / 1000}s`);
          await sleep(this.retry_delay);
          session_log('retry...');
          this.is_running = false;
        }
      }
    }
  }
}
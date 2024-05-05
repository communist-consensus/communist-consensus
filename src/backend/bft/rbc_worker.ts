import { parentPort, workerData } from 'worker_threads';
import {
  IDHTBroadcastHandlerMap,
  IDHTHelper,
  IRBCWorkerInitialData,
  RBCFromWorkerMessage,
  RBCFromWorkerMessageType,
  RBCProtocols,
  RBCRPCScope,
  RBCToWorkerMessage,
  RBCToWorkerMessageType,
} from '../types';
import createReliableBroadcast from './rbc';
import { gen_id } from '../utils';
import { Mutex } from 'async-mutex';

const mutex = new Mutex();

const initial_data = workerData as IRBCWorkerInitialData;
console.log('#initialData', initial_data);

const call_list = new Map<string, Function>();
async function RPC_call<T>(scope: RBCRPCScope, fn: string, args: any) {
  const call_id = gen_id();
  return new Promise<T>(async (resolve) => {
    const msg: RBCFromWorkerMessage = {
      scope,
      fn,
      type: RBCFromWorkerMessageType.rpc,
      args,
      call_id,
    };
    parentPort.postMessage(msg);
    call_list.set(call_id, resolve);
  });
}

(async () => {
  const listeners: IDHTBroadcastHandlerMap<RBCProtocols> = new Map();
  const dht_helper: IDHTHelper<RBCProtocols> = {
    addListener: (subProtocol, handler) => {
      if (!listeners.get(subProtocol)) {
        listeners.set(subProtocol, []);
        const worker_msg: RBCFromWorkerMessage = {
          type: RBCFromWorkerMessageType.addListener,
          subProtocol: subProtocol,
        };
        parentPort.postMessage(worker_msg);
      }
      listeners.get(subProtocol).push(handler);
    },
    removeListener: (subProtocol, handler) => {
      console.warn('not implemented');
    },

    broadcast: async (msg) => {
      const worker_msg: RBCFromWorkerMessage = {
        scope: RBCRPCScope.dht_helper,
        fn: 'broadcast',
        type: RBCFromWorkerMessageType.rpc,
        args: [msg],
      };
      parentPort.postMessage(worker_msg);
    },
    send: async (target, msg) => {
      const worker_msg: RBCFromWorkerMessage = {
        scope: RBCRPCScope.dht_helper,
        fn: 'send',
        type: RBCFromWorkerMessageType.rpc,
        args: [target, msg],
      };
      parentPort.postMessage(worker_msg);
    },

    get: (cid) => {
      return RPC_call(RBCRPCScope.dht_helper, 'get', [cid]);
    },
    provide: (x) => {
      return RPC_call(RBCRPCScope.dht_helper, 'provide', [x]);
    },
  };
  parentPort.on('message', async (msg: RBCToWorkerMessage) => {
    console.log(initial_data.node_id, 'from main:', msg);
    if (msg.type === RBCToWorkerMessageType.RBCinternal) {
      listeners.get(msg.subProtocol)?.forEach((handler) => {
        handler(msg.peer, msg, {} as any, {} as any);
      });
    } else if (msg.type === RBCToWorkerMessageType.RPCResponse) {
      const fn = call_list.get(msg.call_id);
      if (fn) {
        fn(msg.data);
        call_list.delete(msg.call_id);
      }
    }
  });
  await createReliableBroadcast({
    ...initial_data,
    mutex,
    root_block_cid: initial_data.root_block_cid,
    dht_helper: dht_helper,
    resolveOne: (node_id) => {
      const worker_msg: RBCFromWorkerMessage = {
        type: RBCFromWorkerMessageType.resolveOne,
        node_id,
      };
      parentPort.postMessage(worker_msg);
    },
  });
})();

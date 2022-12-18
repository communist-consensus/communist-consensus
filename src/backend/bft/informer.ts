import { SubProtocol, Signature, InformerBody } from '../types';
import { decode } from '../utils';
import { NodeIndex } from './types';

type SubProtocolListener = (sender: NodeIndex, body: InformerBody) => void;

/**
 * 基于 libp2p 的通信协议 Informer
 */
export class Informer {
  sub_protocol_listeners: Map<
    SubProtocol,
    Set<SubProtocolListener>
  > = new Map();

  init() {
    for (const i of Object.keys(SubProtocol)) {
      this.sub_protocol_listeners.set(SubProtocol[i], new Set());
    }
  }

  addListener(protocol: SubProtocol, cb: SubProtocolListener) {
    this.sub_protocol_listeners.get(protocol).add(cb);
  }

  removeListener(protocol: SubProtocol, cb: SubProtocolListener) {
    this.sub_protocol_listeners.get(protocol).delete(cb);
  }

  onMessge(msg: Uint8Array, sender: number) {
    const body = decode<InformerBody>(msg);

    // TODO verify

    // TODO if ctx.epoch_id != body.epoch_id return;

    for (let sender = 0; sender < this.sub_protocol_listeners.size; ++sender) {
      for (const i of Object.keys(SubProtocol)) {
        for (let cb of this.sub_protocol_listeners.get(SubProtocol[i])) {
          cb(sender, body);
        }
      }
    }
  }

  broadcast(protocol: SubProtocol, payload: Uint8Array) {
    // TODO
  }

  send(target: number, protocol: SubProtocol, payload: Uint8Array) {
    // TODO
  }
}

const informer = new Informer();
export default informer;

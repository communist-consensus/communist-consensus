import { MessageType, Signature } from '../types';
import { decode } from '../utils';

type Sender = number;
type Listener<T> = (sender: Sender, data: T, signature: Uint8Array) => void;
class Messager {
  listeners: Map<
    Sender,
    Map<MessageType, Set<Listener<any>>>
  > = new Map();

  init(sender: Sender) {
    const m: Map<MessageType, Set<(sender: Sender, data: any) => void>> = new Map();
    this.listeners.set(sender, m);
    for (const i of Object.keys(MessageType)) {
      m.set(MessageType[i], new Set());
    }
  }

  addListener<T>(sender: Sender, type: MessageType, cb: Listener<T>) {
    if (!this.listeners.get(sender)) return;
    this.listeners.get(sender).get(type).add(cb);
  }

  removeListener(sender: Sender, type: MessageType, cb: Listener<any>) {
    if (!this.listeners.get(sender)) return;
    this.listeners.get(sender).get(type).delete(cb);
  }

  onMessge(msg: Uint8Array, sender: number) {
    const { type, data, signature } = decode<{
      type: MessageType;
      data: any;
      signature: Signature;
    }>(msg);
    if (!verifySignature(data, publicKeys.get(sender), signature)) {
      return;
    }

    for (let sender = 0; sender < this.listeners.size; ++sender) {
      const typesMap = this.listeners.get(sender);
      const types = Object.keys(typesMap);
      types.forEach((type) => {
        for (let cb of typesMap.get(MessageType[type])) {
          cb(sender, data, signature);
        }
      });
    }
  }
}

const messager = new Messager();
export default messager;

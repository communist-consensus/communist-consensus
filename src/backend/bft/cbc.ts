import EventEmitter from 'node:events';
import assert from 'node:assert';
import { SubProtocol, InformerBody } from '../types';
import { encode, decode, hash, ecdsa_vrfy, ecdsa_sign } from '../utils';
import { Informer, } from './informer';
import { Context, NodeID, NodeIndex, } from './types';

enum AtomicProtocol {
  CBC_SEND,
  CBC_ECHO,
  CBC_FINAL,
}

type ConsistentBroadcastMessageSendBody = {
  type: AtomicProtocol.CBC_SEND,
  payload: Uint8Array,
}

type ConsistentBroadcastMessageEchoBody = {
  type: AtomicProtocol.CBC_ECHO,
  signature: Uint8Array,
}

type ConsistentBroadcastMessageFinalBody = {
  type: AtomicProtocol.CBC_FINAL,
  payload: Uint8Array,
}

type ConsistentBroadcastMessageFinalPayload = {
  payload: Uint8Array;
  sigmas: [NodeIndex, Uint8Array][];
}

type ConsistentBroadcastMessageBody = ConsistentBroadcastMessageSendBody | ConsistentBroadcastMessageEchoBody | ConsistentBroadcastMessageFinalBody;

// TODO
type ECDSA_SIGNATURE = any;

export type ConsistentBroadcastCallback = (payload: Uint8Array, sigmas: [NodeIndex, Uint8Array][]) => void;
/**
 * 一个epoch中每个节点的每个session开启一个CBC实例
 * (不支持多session并发)
 * 
 * 每个节点在session sid中广播不同的message m，保证消息m被多数人接收，并且多数人知道m被多数人接收和确认
 */
export class ConsistentBroadcast {
  ctx: Context & {
    sender: NodeIndex;
    informer: Informer;
    input?: () => Promise<Uint8Array>;
  };
  cbc_echo_sshares: Map<NodeIndex, ECDSA_SIGNATURE> = new Map();
  EchoThreshold: number;
  inputBody: Uint8Array;
  cb: ConsistentBroadcastCallback;
  finalSent = false;
  constructor(
    ctx: Context & { sender: NodeIndex; informer: Informer },
    cb: ConsistentBroadcastCallback,
  ) {
    this.cb = cb;
    this.ctx = ctx;
    this.EchoThreshold = this.ctx.N - this.ctx.f;
  }
  broadcastSEND(payload: Uint8Array) {
    const body: ConsistentBroadcastMessageSendBody = {
      type: AtomicProtocol.CBC_SEND,
      payload,
    };
    this.ctx.informer.broadcast(SubProtocol.CBC, encode(body));
  }
  sendECHO(target: number, signature: Uint8Array) {
    const body: ConsistentBroadcastMessageEchoBody = {
      type: AtomicProtocol.CBC_ECHO,
      signature,
    };
    this.ctx.informer.send(target, SubProtocol.CBC, encode(body));
  }
  broadcastFINAL(payload: Uint8Array) {
    const body: ConsistentBroadcastMessageFinalBody = {
      type: AtomicProtocol.CBC_FINAL,
      payload,
    };
    this.ctx.informer.broadcast(SubProtocol.CBC, encode(body));
  }

  hashPayload(sid: string, payload: Uint8Array) {
    return hash({
      sid,
      payload,
    });
  }

  incomingMessageHandler(sender: NodeIndex, body: InformerBody) {
    const data: ConsistentBroadcastMessageBody = decode(body.data);
    if (data.type === AtomicProtocol.CBC_SEND) {
      this.sendECHO(
        sender,
        ecdsa_sign(this.ctx.sSK2, this.hashPayload(this.ctx.sid, data.payload)),
      );
    } else if (data.type === AtomicProtocol.CBC_ECHO) {
      assert(sender === this.ctx.pid);
      assert(
        ecdsa_vrfy(
          this.ctx.sPk2[sender],
          this.cbc_echo_sshares.get(this.ctx.pid),
          data.signature,
        ),
      );
      this.cbc_echo_sshares.set(sender, data.signature);
      if (this.cbc_echo_sshares.size >= this.EchoThreshold && !this.finalSent) {
        if (this.finalSent) return;
        const payload: ConsistentBroadcastMessageFinalPayload = {
          payload: this.inputBody,
          sigmas: [],
        };
        let i = 0;
        for (const pair of this.cbc_echo_sshares) {
          payload.sigmas.push(pair);
          ++i;
          if (i >= this.EchoThreshold) break;
        }
        this.finalSent = true;
        this.broadcastFINAL(encode(payload));
      }
    } else if (data.type === AtomicProtocol.CBC_FINAL) {
      const payload = decode<ConsistentBroadcastMessageFinalPayload>(
        data.payload,
      );
      assert(payload.sigmas.length === this.ctx.N - this.ctx.f);
      assert(
        new Set(payload.sigmas.map((i) => i[0])).size ===
          this.ctx.N - this.ctx.f,
      );
      const digest = this.hashPayload(this.ctx.sid, payload.payload);
      for (const [idx, sig] of payload.sigmas) {
        assert(ecdsa_vrfy(this.ctx.PK2s[idx], digest, sig));
      }
      this.cb(payload.payload, payload.sigmas);
      this.ctx.informer.removeListener(
        SubProtocol.CBC,
        this.incomingMessageHandler,
      );
    }
  }

  async start() {
    if (this.ctx.pid === this.ctx.sender) {
      const m = await this.ctx.input();
      this.inputBody = m;
      this.cbc_echo_sshares.set(
        this.ctx.pid,
        ecdsa_sign(this.ctx.sSK2, this.hashPayload(this.ctx.sid, m)),
      );
      this.broadcastSEND(m);
    }
    this.ctx.informer.addListener(SubProtocol.CBC, this.incomingMessageHandler);
  }
}
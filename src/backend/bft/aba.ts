import EventEmitter from 'node:events';

type Sender = string;
enum BroadcastType {
  est = 'est',
  aux = 'aux',
  conf = 'conf',
}

enum Value {
  negative = 0,
  positive = 1,
  both = 2,
}

function is_subset(v: Value, s: Set<boolean>) {
  if (s.has(true) && v == Value.positive) {
    return true;
  }
  if (s.has(false) && v == Value.negative) {
    return true;
  }
  if (s.has(true) && s.has(false) && v == Value.both) {
    return true;
  }
  return false;
}

export class AsyncBinaryAgreement extends EventEmitter {
  est_sent: Set<boolean> = new Set();
  est_values: Map<boolean, Set<Sender>> = new Map();
  aux_values: Map<boolean, Set<Sender>> = new Map();
  conf_values: Map<Value, Set<Sender>> = new Map();
  is_sent: Map<string, boolean> = new Map();
  r: number;
  broadcast_if_not_sent(type: BroadcastType, input: Value) {
    const id = `${type}_${this.r}_${input}`;
    if (this.is_sent.get(id)) {
      return;
    }
    this.is_sent.set(id, true);
    // TODO
  }

  broadcast_est(input: boolean) {
    this.broadcast_if_not_sent(
      BroadcastType.est,
      input ? Value.positive : Value.negative,
    );
  }

  broadcast_aux(input: boolean) {
    this.broadcast_if_not_sent(
      BroadcastType.aux,
      input ? Value.positive : Value.negative,
    );
  }

  broadcast_conf(input: Set<boolean>) {
    this.broadcast_if_not_sent(
      BroadcastType.conf,
      input.has(true) && input.has(false)
        ? Value.both
        : input.has(true)
        ? Value.positive
        : Value.negative,
    );
  }

  constuctor(input: boolean, r: number, f: number, n: number) {
    this.r = r;
    this.est_values.set(true, new Set());
    this.est_values.set(false, new Set());
    this.aux_values.set(true, new Set());
    this.aux_values.set(false, new Set());
    this.conf_values.set(Value.both, new Set());
    this.conf_values.set(Value.positive, new Set());
    this.conf_values.set(Value.negative, new Set());
    this.start(input, f, r, n);
  }

  est_listener: (sender: Sender, v: boolean) => void;
  aux_listener: (sender: Sender, v: boolean) => void;
  conf_listener: (sender: Sender, v: Value) => void;
  async start(input: boolean, f: number, r: number, n: number) {
    this.broadcast_est(input);

    const est_result = new Set<boolean>();
    await new Promise<void>((resolve) => {
      let resolved = false;
      this.est_listener = (sender: Sender, v: boolean) => {
        const senders = this.est_values.get(v);
        senders.add(sender);

        if (senders.size >= f + 1) {
          this.broadcast_est(v);
        }
        if (senders.size >= 2 * f + 1) {
          est_result.add(v);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      };
      this.on(`est_${r}`, this.est_listener);
    });
    this.broadcast_aux(est_result[Symbol.iterator]().next().value);

    const aux_result = new Set<boolean>();
    await new Promise<void>((resolve) => {
      let resolved = false;
      this.aux_listener = (sender: Sender, v: boolean) => {
        const senders = this.aux_values.get(v);
        senders.add(sender);
        let needs_resolve = false;
        if (this.aux_values.get(true).size >= n - f) {
          needs_resolve = true;
          aux_result.add(true);
        } else if (this.aux_values.get(false).size >= n - f) {
          needs_resolve = true;
          aux_result.add(false);
        } else if (
          this.aux_values.get(true).size + this.aux_values.get(false).size >=
          n - f
        ) {
          needs_resolve = true;
          aux_result.add(true).add(false);
          this.off(`aux_${r}`, this.aux_listener);
        }
        if (needs_resolve && !resolved) {
          resolved = true;
          resolve();
        }
      };
      this.on(`aux_${r}`, this.aux_listener);
    });

    this.broadcast_conf(est_result); // TODO aux_result?
    const conf_result = await new Promise<Value>((resolve) => {
      this.conf_listener = (sender: Sender, v: Value) => {
        const senders = this.conf_values.get(v);
        senders.add(sender);
        if (senders.size >= n - f) {
          this.off(`conf_${r}`, this.conf_listener);
          resolve(v);
        } else if (
          Array.from(this.conf_values)
            .filter(([v, senders]) => is_subset(v, est_result))
            .reduce((m, [v, senders]) => m + senders.size, 0) >=
          n - f
        ) {
          this.off(`conf_${r}`, this.conf_listener);
          resolve(Value.both);
        }
      };
      this.on(`conf_${r}`, this.conf_listener);
    });

    this.off(`est_${r}`, this.est_listener);
    this.off(`aux_${r}`, this.aux_listener);
    // const s = await coin(r);

    // TODO
  }
}
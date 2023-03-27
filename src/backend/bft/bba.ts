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

export default function BaisedBinaryAgreement(
  input: boolean,
  r: number,
  f: number,
  n: number,
) {
  const ee = new EventEmitter();
  const est_sent: Set<boolean> = new Set();
  const est_values: Map<boolean, Set<Sender>> = new Map();
  const aux_values: Map<boolean, Set<Sender>> = new Map();
  const conf_values: Map<Value, Set<Sender>> = new Map();
  const is_sent: Map<string, boolean> = new Map();
  est_values.set(true, new Set());
  est_values.set(false, new Set());
  aux_values.set(true, new Set());
  aux_values.set(false, new Set());
  conf_values.set(Value.both, new Set());
  conf_values.set(Value.positive, new Set());
  conf_values.set(Value.negative, new Set());
  function broadcast_if_not_sent(type: BroadcastType, input: Value) {
    const id = `${type}_${r}_${input}`;
    if (is_sent.get(id)) {
      return;
    }
    is_sent.set(id, true);
    // TODO
  }

  function broadcast_est(input: boolean) {
    broadcast_if_not_sent(
      BroadcastType.est,
      input ? Value.positive : Value.negative,
    );
  }

  function broadcast_aux(input: boolean) {
    broadcast_if_not_sent(
      BroadcastType.aux,
      input ? Value.positive : Value.negative,
    );
  }

  function broadcast_conf(input: Set<boolean>) {
    broadcast_if_not_sent(
      BroadcastType.conf,
      input.has(true) && input.has(false)
        ? Value.both
        : input.has(true)
        ? Value.positive
        : Value.negative,
    );
  }

  let est_listener: (sender: Sender, v: boolean) => void;
  let aux_listener: (sender: Sender, v: boolean) => void;
  let conf_listener: (sender: Sender, v: Value) => void;
  async function start(input: boolean, f: number, r: number, n: number) {
    broadcast_est(input);

    const est_result = new Set<boolean>();
    await new Promise<void>((resolve) => {
      let resolved = false;
      est_listener = (sender: Sender, v: boolean) => {
        const senders = est_values.get(v);
        senders.add(sender);

        if (senders.size >= f + 1) {
          broadcast_est(v);
        }
        if (senders.size >= 2 * f + 1) {
          est_result.add(v);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      };
      ee.on(`est_${r}`, est_listener);
    });
    broadcast_aux(est_result[Symbol.iterator]().next().value);

    const aux_result = new Set<boolean>();
    await new Promise<void>((resolve) => {
      let resolved = false;
      aux_listener = (sender: Sender, v: boolean) => {
        const senders = aux_values.get(v);
        senders.add(sender);
        let needs_resolve = false;
        if (aux_values.get(true).size >= n - f) {
          needs_resolve = true;
          aux_result.add(true);
        } else if (aux_values.get(false).size >= n - f) {
          needs_resolve = true;
          aux_result.add(false);
        } else if (
          aux_values.get(true).size + aux_values.get(false).size >=
          n - f
        ) {
          needs_resolve = true;
          aux_result.add(true).add(false);
          ee.off(`aux_${r}`, aux_listener);
        }
        if (needs_resolve && !resolved) {
          resolved = true;
          resolve();
        }
      };
      ee.on(`aux_${r}`, aux_listener);
    });

    broadcast_conf(est_result); // TODO aux_result?
    const conf_result = await new Promise<Value>((resolve) => {
      conf_listener = (sender: Sender, v: Value) => {
        const senders = conf_values.get(v);
        senders.add(sender);
        if (senders.size >= n - f) {
          ee.off(`conf_${r}`, conf_listener);
          resolve(v);
        } else if (
          Array.from(conf_values)
            .filter(([v, senders]) => is_subset(v, est_result))
            .reduce((m, [v, senders]) => m + senders.size, 0) >=
          n - f
        ) {
          ee.off(`conf_${r}`, conf_listener);
          resolve(Value.both);
        }
      };
      ee.on(`conf_${r}`, conf_listener);
    });

    ee.off(`est_${r}`, est_listener);
    ee.off(`aux_${r}`, aux_listener);
    // const s = await coin(r);

    // TODO
  }
  start(input, f, r, n);
}

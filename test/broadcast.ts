import assert from 'assert';
import KBucket from 'k-bucket';
import { KBucketContact } from '../src/shared/types';
import { sleep } from '../src/shared/utils';
import { get_bucket_node, get_common_bucket_node, shuffle, random } from '../src/backend/utils';
import { forward, broadcast_to_buckets, compute_n_replica } from '../src/backend/consensus/utils';

function print_kb(kb) {
  function print(node, depth = 1) {
    const prefix = new Array(depth)
      .fill(0)
      .map((i) => '')
      .join('-');
    if (node.contacts !== null && node.contacts.length) {
      node.contacts.forEach((i) => console.log(prefix + i.id[0].toString(2)));
    } else {
      if (node.left) {
        console.log(prefix + '[0]');
        print(node.left, depth + 1);
      }
      if (node.right) {
        console.log(prefix + '[1]');
        print(node.right, depth + 1);
      }
    }
  }
  print(kb.root);
}

async function do_broadcast(options: {
  n: number;
  k: number;
  n_node_per_bucket: number;
  up_rate: number;
  success_rate: number;
  latency_range: [number, number];
}) {
  const { n, k, n_node_per_bucket, success_rate, up_rate, latency_range } = options;
  const kbs = {};
  const nodes = {};
  for (let i = 0; i < n; ++i) {
    nodes[i.toString()] = build_node(
      i.toString(),
      Buffer.from([
        Math.floor(random() * 256),
        Math.floor(random() * 256),
        Math.floor(random() * 256),
      ]),
    );
  }

  Object.keys(nodes).forEach((name) => {
    const kb = new KBucket({
      localNodeId: nodes[name].id,
      numberOfNodesPerKBucket: n_node_per_bucket,
      numberOfNodesToPing: 1,
    });
    kbs[name] = kb;
    kbs[name].on('ping', (old_contacts, new_contact) => {
      const oldest = old_contacts[0];

      if (oldest) {
        kb.remove(oldest.id);
      }

      kb.add(new_contact);
    });
    // 顺序必须随机
    shuffle(Object.keys(nodes)).forEach((i) => {
      if (i !== name) {
        kbs[name].add(nodes[i]);
      }
    });
  });

  let signal = 0;
  async function broadcast_one(
    target: KBucketContact,
    src: Uint8Array,
    msg: any,
  ) {
    ++signal;
    setTimeout(() => {
      target.on_broadcast(src, msg);
      --signal;
    }, random() * (latency_range[1] - latency_range[0]) + latency_range[0]);
  }

  function build_node(name, id) {
    const received = {};
    const up = random() < up_rate;
    return {
      id,
      received,
      on_broadcast: (source, msg) => {
        if (!up) {
          return;
        }
        if (random() > success_rate) {
          return;
        }
        if (received[msg]) {
          received[msg]++;
          return;
        }
        received[msg] = 1;
        // console.log(name + ' receive msg(' + msg + ') from ' + (source[0]).toString(2));
        forward({
          kb: kbs[name],
          msg,
          src: source,
          k,
          broadcast_one,
        });
      },
    };
  }

  const msg = 'msg_test';
  broadcast_to_buckets({
    kb: kbs[Object.keys(nodes)[0]],
    msg,
    k,
    broadcast_one,
  });

  await sleep(latency_range[1] * 2);
  while (signal) {
    await sleep(latency_range[1] * 2);
  }

  let n_received = 0;
  let avg_msgs_received = 0;
  for (const i of Object.keys(nodes)) {
    const node = nodes[i];
    if (node.received[msg]) {
      avg_msgs_received += node.received[msg];
      ++n_received;
    }
  }
  avg_msgs_received /= Object.keys(nodes).length;
  const msg_received_rate = n_received / Object.keys(nodes).length;

  return { msg_received_rate, avg_msgs_received, n_received };
}

describe('kbucket broadcast', function() {
  it('compute k', function() {
    [
      [733126205, 10],
      [355529, 9],
      [2958, 8],
      [147, 7],
    ].forEach(i => {
      const f = compute_n_replica;
      const k = compute_n_replica({
        success_rate: 0.9,
        n: i[0],
        up_rate: 0.6,
        expected_success_rate: 0.8,
      });
      assert.strictEqual(k, i[1]);
    });
  });
  it('broadcast, messages received per node', async function() {
    const k = 7;
    const g = (a, b) => k * a * a * b;
    console.log('expected:');
    let s = '';
    for (let b = 1; b > 0.6; b -= 0.1) {
      if (b == 1) {
        s += `     |1   |0.9  |0.8  |0.7  |0.6\n`;
      }
      for (let a = 1; a > 0.6; a -= 0.1) {
        s += `${a === 1 ? b.toFixed(2) : '  '} |${g(a, b).toFixed(2)}`;
      }
      s += '\n';
    }
    console.log(s);
    async function f(a, b) {
      const { avg_msgs_received } = await do_broadcast({
        n: 1000,
        n_node_per_bucket: 20,
        latency_range: [100, 200],
        up_rate: a,
        success_rate: b,
        k,
      });
      return avg_msgs_received;
    }
    console.log('simulation:');
    s = '';
    const res = {};
    for (let b = 1; b > 0.6; b -= 0.1) {
      if (b == 1) {
        s += `     |1   |0.9  |0.8  |0.7  |0.6\n`;
      }
      for (let a = 1; a > 0.6; a -= 0.1) {
        res[a + '-' + b] = (await f(a, b)).toFixed(2);
        s += `${a === 1 ? b.toFixed(2) : '  '} |${res[a + '-' + b]}`;
      }
      s += '\n';
    }
    console.log(s);
    function devi(a, b) {
      return Math.abs(a - b) / Math.max(a, b);
    }
    console.log('devidation:');
    s = '';
    for (let b = 1; b > 0.6; b -= 0.1) {
      if (b == 1) {
        s += `     |1   |0.9  |0.8  |0.7  |0.6\n`;
      }
      for (let a = 1; a > 0.6; a -= 0.1) {
        const deviation = devi(g(a, b), res[a + '-' + b]);
        assert.strictEqual(deviation < 0.2, true);
        s += `${a === 1 ? b.toFixed(2) : '  '} |${deviation.toFixed(2)}`;
      }
      s += '\n';
    }
    console.log(s);
  });
  it('broadcast, success_rate up_rate', async function() {
    for (const [success_rate, up_rate] of [
      [0.9, 0.9],
      [0.8, 0.9],
      [0.7, 0.9],
      [0.7, 0.8],
      [0.6, 0.9],
      [0.9, 0.8],
      [0.8, 0.8],
      [0.9, 0.7],
      [0.8, 0.7],
      [0.9, 0.6],
    ]) {
      console.log(`[${success_rate}, ${up_rate}]`);
      const n_node_per_bucket = 20;
      let avg_received_rate = 0;
      let n_test = 0;
      for (let i = 300; i <= 1500; i += 300) {
        const n = i;
        const k = compute_n_replica({
          n,
          success_rate,
          up_rate,
          expected_success_rate: 0.9,
        });
        const { msg_received_rate } = await do_broadcast({
          n,
          n_node_per_bucket,
          latency_range: [100, 200],
          up_rate,
          success_rate,
          k,
        });
        avg_received_rate += msg_received_rate;
        n_test ++;
        console.log(`online_receive_rate: ${msg_received_rate * n / (n * up_rate)}`);
        console.log(
          `expected_receive_rate: ${Math.pow(
            (2 - Math.pow(1 - up_rate * success_rate, k * up_rate)) / 2,
            Math.log2(n),
          )}`,
        );
      }
      avg_received_rate /= n_test;
      console.log(`======== avg_receive_rate: ${avg_received_rate} ======`);
      assert.strictEqual(avg_received_rate > 0.5, true);
    }
  });
});

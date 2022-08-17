import BlockChain from './blockchain';
import mysql from 'mysql';
import { Request } from 'express';
import PeerId from 'peer-id';
import express from 'express';
import bodyParser from 'body-parser';
import {
  Action,
  ActionBundle,
  ActionSignatures,
  ActionSubjects,
  ActionType,
  InitialParams,
  MID_B58,
  PeerJSON,
  Profile,
  RIConfig,
  VITaskType,
} from '../shared/types';
import { init as init_p2p } from './p2p';
import {
  b64_to_uint8array,
  decode,
  encode,
  encode_to_str,
  random,
  RSA_verify,
  utf8_to_uint8array,
} from '../shared/utils';
import EventEmitter from 'events';
import { DATABASE_CONFIG } from '../shared/constant';

type Req = Request & {
  blockchain: BlockChain;
  body: { [key: string]: string };
};

const blockchains = new Map<MID_B58, BlockChain>();

let ready = false;
export const listener = new EventEmitter();
export function get_ready() {
  return ready;
}
const app = express();
app.listen(4000, async () => {
  ready = true;
  console.log('app ready');
  listener.emit('ready');
});
app.on('error', (err) => {
  console.log(err);
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('dist/frontend'));

app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', `http://localhost:8080`);
  res.header(
    'Access-Control-Allow-Method',
    'GET, PUT, POST, DELETE, HEAD, OPTIONS',
  );
  res.header('Access-Control-Allow-Headers', 'content-type');
  next();
});

app.post('/resume', async (req, res) => {
  const body: {
    config: string;
  } = req.body;
  // TODO verify
  const config: RIConfig = JSON.parse(body.config);
  const blockchain = await init_p2p(config, { clear_db: false });
  blockchains.set(config.my_peer_json.id, blockchain);
  await blockchain.start();
  res.json({ ok: true });
});

app.post('/init', async (req: Req, res) => {
  const body: {
    initial_params: string;
  } = req.body;
  const {
    config,
    initial_action_bundle,
    initial_action_signatures,
    initial_action_subjects,
    initial_timestamp,
    initial_min_witness_broadcast_window,
    initial_min_actions_broadcast_window,
  } = decode<InitialParams>(body.initial_params);
  // TODO verify

  const blockchain = await init_p2p(config, { clear_db: true });
  blockchains.set(config.my_peer_json.id, blockchain);

  await blockchain.start({
    initial_action_bundle,
    initial_action_signatures,
    initial_action_subjects,
    initial_timestamp,
    initial_min_witness_broadcast_window,
    initial_min_actions_broadcast_window,
  });

  res.json({
    ok: true,
    port: blockchain.ctx.port,
    p2p_address: blockchain.ctx.p2p_address,
  });
});

app.post('/initialized', async (req, res) => {
  const blockchain = blockchains.get(req.body.mid);
  res.json({
    ready: !!blockchain,
    initialized: blockchain && !!blockchain.ctx.pending_block,
  });
});

const tokens = new Set<string>();
app.post('/token', async (req, res) => {
  const token = random().toString();
  tokens.add(token);
  setTimeout(() => tokens.delete(token), 10 * 1000);
  res.json({
    token,
  });
});

app.post('*', async (req: Req, res, next) => {
  const signature = decode<Uint8Array>(req.body.signature);
  const token = req.body.token;
  const mid = req.body.mid;

  const blockchain = blockchains.get(mid);
  if (!blockchain) {
    res.json({ code: -1 });
    return;
  }

  if (!tokens.has(token)) {
    res.json({ code: -2 });
    return;
  }

  if (
    await RSA_verify(
      blockchain.ctx.libp2p.peerId.pubKey,
      encode(token),
      signature,
    )
  ) {
    req.blockchain = blockchain;
  } else {
    res.json({ code: -3 });
    return;
  }

  next();
});

app.post('/connect_to_peer', (req: Req, res) => {
  const { addr } = req.body as {
    addr: string;
  };
  req.blockchain.ctx.libp2p.dialer.connectToPeer(addr);
  res.json({ code: 0 });
});

app.post(
  '/proposal/:proposal_id/conference/:conference_id/solution/:solution_id/voted',
  async (req: Req, res) => {
    res.json({
      voted: await req.blockchain.db.proposal.has_vote_solution(
        req.body.mid,
        req.params.conference_id,
        req.params.solution_id,
      ),
    });
  },
);
app.post(
  '/proposal/:proposal_id/conference/:conference_id/solution/:solution_id/vote',
  async (req: Req, res) => {
    await req.blockchain.db.proposal.vote_solution(
      req.body.mid,
      req.params.proposal_id,
      req.params.conference_id,
      req.params.solution_id,
    );
    res.json({ code: 0 });
  },
);
app.post('/sub_domains/:domain_id/:page', async (req: Req, res) => {
  res.json(
    await req.blockchain.db.domain.get_sub_domains(
      req.params.domain_id,
      parseInt(req.params.page),
    ),
  );
});
app.post('/domains/:page', async (req: Req, res) => {
  res.json(
    await req.blockchain.db.domain.get_domains(parseInt(req.params.page)),
  );
});
app.post('/proposal/:proposal_id/round/:round_id/conferences/:page', async (req: Req, res) => {
  res.json({
    code: 0,
    conferences: await req.blockchain.db.proposal.get_conferences(
      req.params.proposal_id,
      parseInt(req.params.round_id),
      parseInt(req.params.page),
    ),
  });
});
app.post(
  '/proposal/:proposal_id/conference/:conference_id/solution/:solution_id/votes',
  async (req: Req, res) => {
    res.json({
      code: 0,
      votes: await req.blockchain.db.proposal.get_votes(
        req.params.proposal_id,
        req.params.conference_id,
        req.params.solution_id,
      ),
    });
  },
);
app.post(
  '/proposal/:proposal_id/round/:round_id/conference/:conference_id/solutions/:page',
  async (req: Req, res) => {
    res.json({
      code: 0,
      solutions: await req.blockchain.db.proposal.get_conference_solutions(
        req.params.proposal_id,
        parseInt(req.params.round_id),
        req.params.conference_id,
        parseInt(req.params.page),
      ),
    });
  },
);
app.post('/proposals', async (req: Req, res) => {
  res.json(
    await req.blockchain.db.domain.get_proposals(
      req.body.domain_id,
      parseInt(req.body.page),
    ),
  );
});
app.post('/domain/:id', (req, res) => {});
app.post('/conference/:id', (req, res) => {});
app.post('/proposal/:id', async (req: Req, res) => {
  res.json({
    code: 0,
    proposal: await req.blockchain.db.proposal.get_proposal(req.params.id),
  });
});

app.post('/ipfs/add', async (req: Req, res) => {
  res.json({
    cid: await req.blockchain.ctx.ipfs.add(decode(req.body.content)),
  });
});
app.post('/ipfs/get/:id', async (req: Req, res) => {
  res.json({
    content: encode_to_str(await req.blockchain.ctx.ipfs.get(req.params.id)),
  });
});
app.post('/solution/:id', async (req: Req, res) => {
  res.json({
    solution: encode_to_str(
      await req.blockchain.db.proposal.get_solution(req.params.id),
    ),
  });
});
app.post('/peer/:mid', async (req: Req, res) => {
  res.json({
    peer: encode_to_str(
      await req.blockchain.db.peer.get_peer(req.params.mid),
    ),
  });
});
app.post('/peers/:page', async (req: Req, res) => {
  res.json({
    peers: encode_to_str(
      await req.blockchain.db.peer.get_peers(parseInt(req.params.page)),
    ),
  });
});
app.post('/latest_block', async (req: Req, res) => {
  res.json({
    code: 0,
    block: await req.blockchain.ctx.db.get_latest_block(),
  });
});
app.post('/pending_block', (req: Req, res) => {
  const pending_block = req.blockchain.ctx.pending_block;
  res.json({
    pending_block: pending_block
      ? {
          ...pending_block,
          next: {
            ...pending_block.next,
            next: undefined,
            prev: undefined,
          },
          prev: {
            ...pending_block.prev,
            next: undefined,
            prev: undefined,
          },
        }
      : undefined,
  });
});

app.post('/blocks/:page', async (req: Req, res) => {
  res.json(await req.blockchain.ctx.db.get_blocks(parseInt(req.params.page)));
});
app.post('/block/:id', async (req: Req, res) => {
  res.json({
    block: await req.blockchain.ctx.db.get_block(req.params.id),
  });
});

app.post('/commit_actions', async (req: Req, res) => {
  const cached = await req.blockchain.add_actions(req.body.actions);
  res.json({
    cached,
  });
});

app.post('/proposal/:proposal_id/conference/:conference_id/solution/:solution_id/comment', async (req: Req, res) => {
  await req.blockchain.db.proposal.add_solution_comment(
    req.body.id,
    req.params.solution_id,
    req.body.content_cid,
  );
  res.json({
    code: 0,
  });
});

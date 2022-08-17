import assert from 'assert';
import { get_instance, init } from '../src/backend/p2p';
import { Action, ActionType, Profile, ProposalID, ProposalStatus, RIConfig, RIPeerEvent, BlockContext, BlockCtxState, VITaskType, WitnessTestimony, Actions, ActionBundle, ActionSubjects, ActionSignatures, InitialParams } from '../src/shared/types';
import { encode_to_str, get_now, pubkey_str_to_uint8array, RSA_sign, sleep, uint8array_to_b64 } from '../src/shared/utils';
import { config as config_a } from '../config/config.local_a';
import { config as config_b } from '../config/config.local_b';
import { encode } from '../src/backend/utils';
import PeerId from 'peer-id';
import { AHEAD_OF_ROOT_BLOCK } from '../src/shared/constant';
import axios from 'axios';
import { get_ready, listener } from '../src/backend/app';
import BlockChain from '../src/backend/blockchain';

const default_domain_name = '核心';

const get_initial_action_bundle = (profile_a: Profile, profile_b: Profile): ActionBundle => ([[
  {
    type: ActionType.InitialAction,
    tasks: [
      {
        type: VITaskType.DomainAdd,
        supported_types: [
          VITaskType.SelfUpgrade,
          VITaskType.DomainAdd,
          VITaskType.DomainMerge,
          VITaskType.DomainModify,
          VITaskType.PeerAdd,
          VITaskType.PeerDelete,
          VITaskType.RevokeProposal,
          VITaskType.AssignToEntity,
        ],
        name: default_domain_name,
      },
      {
        type: VITaskType.PeerAdd,
        profile: profile_a,
      },
      {
        type: VITaskType.PeerAdd,
        profile: profile_b,
      },
    ],
  },
]]);
const url_prefix = 'http://localhost:4000';

export async function request<T, R>({
  url,
  data,
  peer,
}: {
  url: string;
  data?: T;
  peer?: PeerId;
}) {
  const token = (await axios.post(`${url_prefix}/token`)).data.token;
  return (await axios.post(url, {
    mid: peer.toB58String(),
    token,
    signature: encode_to_str(await RSA_sign(peer.privKey, encode(token))),
    ...(data ? data : {}),
  })).data as R;
}

let initial_timestamp: number;

describe('blockchain', function () {
  async function init_p2p(config_a: RIConfig, config_b: RIConfig) {
    if (!get_ready()) {
      await new Promise<void>((resolve) =>
        listener.once('ready', () => resolve()),
      );
    }
    if (!initial_timestamp) {
      initial_timestamp = Math.floor(Date.now() / 1000);
    }

    const [profile_a, profile_b]: Profile[] = [
      {
        name: '王小红',
        public_key: config_a.my_peer_json.pubKey,
        proof_cid: 'x',
      },
      {
        name: '李小绿',
        public_key: config_b.my_peer_json.pubKey,
        proof_cid: 'b',
      },
    ].sort((a, b) => (a.public_key > b.public_key ? 1 : -1));

    const initial_action_bundle: ActionBundle = get_initial_action_bundle(
      profile_a,
      profile_b,
    );

    const peer_a = await PeerId.createFromJSON(config_a.my_peer_json);
    const peer_b = await PeerId.createFromJSON(config_b.my_peer_json);
    const use_a = profile_a.public_key === config_a.my_peer_json.pubKey;
    const initial_action_subjects: ActionSubjects = [
      use_a ? config_a.my_peer_json.id : config_b.my_peer_json.id,
    ];
    const initial_action_signatures: ActionSignatures = [
      await RSA_sign(
        use_a ? peer_a.privKey : peer_b.privKey,
        encode([
          // TODO
          initial_action_bundle[0],
          AHEAD_OF_ROOT_BLOCK,
          initial_timestamp,
        ]),
      ),
    ];

    const t = 5;
    const initial_params_a: InitialParams = {
      config: config_a,
      initial_timestamp,
      initial_min_actions_broadcast_window: t,
      initial_min_witness_broadcast_window: t,
      initial_action_bundle,
      initial_action_signatures,
      initial_action_subjects,
    };
    const initial_params_b: InitialParams = {
      config: config_b,
      initial_timestamp,
      initial_min_actions_broadcast_window: t,
      initial_min_witness_broadcast_window: t,
      initial_action_bundle,
      initial_action_signatures,
      initial_action_subjects,
    };
    const res_a = await request<{}, { p2p_address: string }>({
      url: `${url_prefix}/init`,
      data: {
        initial_params: encode_to_str(initial_params_a),
      },
      peer: peer_a,
    });
    const res_b = await request<{}, { p2p_address: string }>({
      url: `${url_prefix}/init`,
      data: {
        initial_params: encode_to_str(initial_params_b),
      },
      peer: peer_b,
    });

    await request({
      url: `${url_prefix}/connect_to_peer`,
      data: {
        addr: res_b.p2p_address,
      },
      peer: peer_a,
    });

    await request({
      url: `${url_prefix}/connect_to_peer`,
      data: {
        addr: res_a.p2p_address,
      },
      peer: peer_b,
    });
  }

  async function wait_actions_finished(peer: BlockChain) {
    const cycle_id = peer.ctx.pending_block.cycle_id + 1;
    await new Promise<void>((resolve) => {
      peer.on(RIPeerEvent.after_apply_actions, (stage: BlockContext) => {
        if (stage.cycle_id >= cycle_id && stage.actions.length) {
          resolve();
        }
      });
    });
  }

  async function wait_cycle_id_finished(peer: BlockChain, cycle_id: number) {
    await new Promise<void>((resolve) => {
      peer.on(RIPeerEvent.witness_broadcast_end, (stage: BlockContext) => {
        if (stage.cycle_id >= cycle_id) {
          resolve();
        }
      });
    });
  }

  // 自升级
  it.only('self upgrade', async function () {
    await init_p2p(config_a, config_b);
    const peer_a = get_instance(config_a.my_peer_json.id);
    const peer_b = get_instance(config_b.my_peer_json.id);

    await Promise.all([
      wait_cycle_id_finished(peer_a, 2),
      wait_cycle_id_finished(peer_b, 2),
    ]);

    const { domains } = await peer_a.ctx.db.domain.get_domains(1, 1);
    assert.strictEqual(domains.length, 1);
    assert.strictEqual(domains[0].name, default_domain_name);
    peer_a.add_actions([
      {
        type: ActionType.MakeProposal,
        proposal: {
          title: '竞选一班体育委员',
          content_cid: await peer_a.ctx.ipfs.add('可以自荐也可以推荐其他人'),
          domain_ids: [domains[0].id],
          properties: {
            discussion_voting_duration: 60,
            max_n_proposer: 20,
          },
          default_solution: {
            content_cid: await peer_a.ctx.ipfs.add('推荐李小绿'),
            tasks: [
              // {
              //   type: VITaskType.SelfUpgrade,
              //   script: 'console.log(123)',
              // },
              {
                type: VITaskType.AssignToEntity,
                mid: config_a.my_peer_json.id,
              },
            ],
          },
        },
      },
    ]);
    await wait_actions_finished(peer_a);
    const { proposals } = await peer_a.ctx.db.domain.get_proposals(
      domains[0].id,
      1,
    );
    assert.strictEqual(proposals.length > 0, true);
    const proposal_id = proposals[0].proposal_id;

    peer_b.add_actions([
      {
        type: ActionType.SetProposalProperties,
        proposal_id,
        properties: {
          max_n_proposer: 30,
          discussion_voting_duration: 900,
        },
      },
      {
        type: ActionType.CommitSolution,
        proposal_id,
        solution: {
          content_cid: await peer_b.ctx.ipfs.add('推荐王小红'),
          tasks: [
            {
              type: VITaskType.AssignToEntity,
              mid: config_b.my_peer_json.id,
            },
          ],
        },
      },
    ]);
    await wait_actions_finished(peer_b);
    const conference_id = await peer_b.ctx.db.proposal.get_which_conference(proposals[0].proposal_id, 1, config_b.my_peer_json.id);
    const solutions = await peer_b.ctx.db.proposal.get_conference_solutions(proposal_id, 1, conference_id, 1);
    assert.strictEqual(solutions.length, 2);
    // await Promise.all([peer_b.stop(), peer_a.stop()]);
  });

  // 投票 + 多 solution 晋级，保留 solution 票数且属于同作者的 solution 分配到同一个 conference

  // solution 未晋级，提交新的 solution 重新分配 conference（票数为0）

  // set proposal properties 更新会议时间

  /*

  // 模拟掉线超时并恢复

  it('two peers cache', async function() {
    // 模拟一个正常节点a，一个低性能节点b
    // 在超时后重新进入确认窗口时，且a已经计算完actions交集，而b未计算完成
    // 此时a向b发出确认窗口的广播，触发缓存机制
    // b 收到n_tries大于自己的n_tries的广播先缓存起来，在计算完成后对比然后转发
    // 转发后清除缓存
    const r2: [number, number][] = []
    peer.on(
      RIPeerEvent.witness_broadcast_before_end,
      (stage: Stage) => {
        if (stage.id < 4) {
          r2.push([
            stage.id,
            stage.witness_broadcast_window_end - stage.witness_broadcast_window_start,
          ]);
        }
      },
    );
    await sleep(5500);
    const origin_actions_broadcast_start = peer.on_internal_actions_broadcast_start.bind(peer);
    const origin_witness_broadcast_start = peer.on_internal_witness_broadcast_start.bind(peer);
    let paused = true;
    peer.on_internal_actions_broadcast_start = async (stage: Stage) => {
      while (paused) {
        await sleep(1000);
      }
      origin_actions_broadcast_start(stage);
    };
    peer.on_internal_witness_broadcast_start = async (stage: Stage) => {
      while (paused) {
        await sleep(1000);
      }
      origin_witness_broadcast_start(stage);
    };

    await sleep(15000);
    paused = false;
    await sleep(35000);
    peer.on_internal_actions_broadcast_start = origin_actions_broadcast_start;
    peer.on_internal_witness_broadcast_start = origin_witness_broadcast_start;
    await peer.stop();
    assert.strictEqual(
      JSON.stringify(r2),
      JSON.stringify([[0, 5000], [1, 20000], [2, 5000], [3, 5000]]),
    );
  });
  */
});
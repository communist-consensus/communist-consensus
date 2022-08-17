import React, { useEffect, useState } from 'react';
import PeerId from 'peer-id';
import ReactDOM from 'react-dom';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import LinearProgress from '@mui/material/LinearProgress';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import RadioGroup from '@mui/material/RadioGroup';
import FormLabel from '@mui/material/FormLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';

import { connect_to_peer, get_config, get_initialized, init_global, load_text_from_file_element, load_text_from_file_element as load_text_from_file_input, post_init, resume, save_to_file, set_config } from './utils';
import { ActionBundle, ActionSignature, ActionSignatures, ActionSubjects, ActionType, PeerJSON, Profile, RIConfig, VITaskType } from '../shared/types';
import Dashboard from './Dashboard';
import { useRef } from 'react';
import { b64_to_uint8array, uint8array_to_b64, RSA_sign } from '../shared/utils';
import { encode } from '../shared/utils';
import { AHEAD_OF_ROOT_BLOCK, AHEAD_OF_ROOT_BLOCK2 } from '../shared/constant';

enum InitMode {
  initiator = 'initiator',
  participant = 'participant',
  reviewer = 'reviewer',
}

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
        name: '核心',
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

const Main = () => {
  const peer = useRef<PeerId>();
  const initial_action_bundle = useRef<ActionBundle>();
  const initial_action_subjects = useRef<ActionSubjects>();
  const signature = useRef<ActionSignature>();
  const [initial_state, set_initial_state] = useState({
    fetched: false,
    initialized: false,
    mode: 'initiator',
    key_mode: 'new',
    activeStep: 0,
    ready: false,
    peer_json_str: '',
    bootstrap_addr: '',
    bootstrap_id_proof: '',
    bootstrap_name: '',
    bootstrap_public_key: '',
    bootstrap_signature: '',
    initial_timestamp: Math.floor(Date.now() / 1000),
    loading: false,
    id_proof: '',
    p2p_addr: '',
    name: '',
    steps: {
      initiator: ['选择初始化方式', '密钥文件', '协商初始化参数', '交换公钥和身份证明', '交换数字签名', '交换 P2P 地址'],
      participant: [
        '选择初始化方式',
        '密钥文件和初始化参数',
        '等待申请结果',
        '同步区块',
      ],
      reviewer: ['选择初始化方式', '同步区块'],
    },
  });

  useEffect(() => {
    (async () => {
      await init_global();
      const status = await get_initialized();
      set_initial_state({
        ...initial_state,
        ready: status.ready,
        initialized: status.initialized,
        fetched: true,
      });
    })();
  }, []);

  const {
    p2p_addr,
    ready,
    fetched,
    initial_timestamp,
    bootstrap_addr,
    bootstrap_name,
    bootstrap_public_key,
    bootstrap_id_proof,
    bootstrap_signature,
    name,
    loading,
    id_proof,
    peer_json_str,
    key_mode,
    initialized,
    mode,
    activeStep,
    steps,
  } = initial_state;
  return (
    <React.Fragment>
      {loading || !fetched ? (
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
        </Box>
      ) : null}
      <Dialog
        open={!ready && fetched && initialized}
        scroll={'paper'}
        fullScreen
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
      >
        <DialogTitle id="scroll-dialog-title">登录去中心化决策网络</DialogTitle>
        <DialogContent dividers={true}>
          <FormLabel>导入密钥文件：</FormLabel>
          <input
            type="file"
            onChange={async (e) => {
              try {
                const content = await load_text_from_file_input(e);
                const json = JSON.parse(content);
                await PeerId.createFromJSON(json);
                set_initial_state({ ...initial_state, loading: true });
                await resume(json);
                location.reload();
              } catch (e) {
                alert(e.toString());
              }
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!ready && fetched && !initialized}
        scroll={'paper'}
        fullScreen
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
      >
        <DialogTitle id="scroll-dialog-title">
          初始化去中心化决策系统
        </DialogTitle>
        <DialogContent dividers={true}>
          <Stepper activeStep={activeStep}>
            {steps[mode].map((label, index) => {
              const stepProps = {};
              const labelProps = {};
              return (
                <Step key={label} {...stepProps}>
                  <StepLabel {...labelProps}>{label}</StepLabel>
                </Step>
              );
            })}
          </Stepper>
          {activeStep === 0 ? (
            <Box mt={2}>
              <FormControl>
                <RadioGroup
                  value={mode}
                  onChange={(e) =>
                    set_initial_state({
                      ...initial_state,
                      mode: e.target.value,
                    })
                  }
                >
                  <FormControlLabel
                    value="initiator"
                    control={<Radio />}
                    label="发起一个去中心化决策网络（需要两个节点同时初始化）"
                  />
                  <FormControlLabel
                    value="participant"
                    control={<Radio />}
                    label="加入一个去中心化决策网络"
                  />
                  <FormControlLabel
                    value="reviewer"
                    control={<Radio />}
                    label="我已加入去中心化决策网络，从离线状态中恢复"
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          ) : null}

          {mode === InitMode.initiator && activeStep === 5 ? (
            <Box mt={2}>
                <Stack spacing={1}>
                  <FormLabel>交换 P2P 地址</FormLabel>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    divider={<Divider orientation="vertical" flexItem />}
                  >
                    <TextField
                      label="我的P2P地址"
                      fullWidth
                      disabled
                      value={p2p_addr}
                      variant="outlined"
                      onChange={(e) =>
                        set_initial_state({
                          ...initial_state,
                          p2p_addr: e.target.value,
                        })
                      }
                    />
                    <TextField
                      label="对方的P2P地址"
                      defaultValue={bootstrap_addr}
                      placeholder="例如： /ip4/127.0.0.1/tcp/36491/p2p/xxx"
                      variant="outlined"
                      fullWidth
                      onChange={(e) =>
                        set_initial_state({
                          ...initial_state,
                          bootstrap_addr: e.target.value,
                        })
                      }
                    />
                  </Stack>
                </Stack>
            </Box>
          ) : null}
          {mode === InitMode.initiator && activeStep === 3 ? (
            <Box mt={2}>
              <FormLabel>
                交换公钥和身份证明，使得公钥与身份绑定（即实名认证）
              </FormLabel>
              <Stack
                direction="row"
                spacing={2}
                divider={<Divider orientation="vertical" flexItem />}
              >
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <TextField
                    label="我的身份信息（姓名）"
                    fullWidth
                    defaultValue={name}
                    variant="outlined"
                    onChange={(e) =>
                      set_initial_state({
                        ...initial_state,
                        name: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="我的身份证明"
                    fullWidth
                    defaultValue={id_proof}
                    variant="outlined"
                    onChange={(e) =>
                      set_initial_state({
                        ...initial_state,
                        id_proof: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="我的公钥"
                    fullWidth
                    multiline
                    disabled
                    defaultValue={JSON.parse(peer_json_str).pubKey}
                    variant="outlined"
                  />
                </Stack>
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <TextField
                    label="对方的身份信息（姓名）"
                    fullWidth
                    defaultValue={bootstrap_name}
                    variant="outlined"
                    onChange={(e) =>
                      set_initial_state({
                        ...initial_state,
                        bootstrap_name: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="对方的身份证明"
                    fullWidth
                    defaultValue={bootstrap_id_proof}
                    variant="outlined"
                    onChange={(e) =>
                      set_initial_state({
                        ...initial_state,
                        bootstrap_id_proof: e.target.value,
                      })
                    }
                  />
                  <TextField
                    fullWidth
                    label="对方的公钥"
                    defaultValue={bootstrap_public_key}
                    multiline
                    variant="outlined"
                    onChange={(e) =>
                      set_initial_state({
                        ...initial_state,
                        bootstrap_public_key: e.target.value,
                      })
                    }
                  />
                </Stack>
              </Stack>
            </Box>
          ) : null}
          {mode === InitMode.initiator && activeStep === 4 ? (
            <Box mt={2}>
                <Stack spacing={1}>
                  <FormLabel>交换初始化行为的数字签名</FormLabel>
                  <Stack
                    direction="row"
                    spacing={2}
                    justifyContent="space-between"
                    divider={<Divider orientation="vertical" flexItem />}
                  >
                    <TextField
                      label="我的数字签名"
                      fullWidth
                      disabled
                      multiline
                      value={uint8array_to_b64(signature.current)}
                      variant="outlined"
                    />
                    <TextField
                      label="对方的数字签名"
                      fullWidth
                      multiline
                      defaultValue={bootstrap_signature}
                      variant="outlined"
                      onChange={(e) =>
                        set_initial_state({
                          ...initial_state,
                          bootstrap_signature: e.target.value,
                        })
                      }
                    />
                  </Stack>
                </Stack>
            </Box>
          ) : null}
          {mode === InitMode.initiator && activeStep === 2 ? (
            <Box mt={2}>
              <FormControl>
                <Stack spacing={1}>
                  <FormLabel>
                    为简化初始化流程，我们要求先由两名成员组成去中心化网络，初始化之后可再通过民主决策增加其他人员。
                  </FormLabel>
                  <FormLabel>
                    初始化时间戳是去中心化决策网络的创建时间，同一个网络中的节点需要设置为相同的值。
                  </FormLabel>
                  <FormLabel>
                    请联系另一位成员协商初始化时间戳，并在之后的步骤中与对方交换公钥和身份证明等信息。
                  </FormLabel>
                  <TextField
                    label="初始化时间戳"
                    defaultValue={initial_timestamp}
                    variant="outlined"
                    onChange={(e) =>
                      set_initial_state({
                        ...initial_state,
                        initial_timestamp: parseInt(e.target.value),
                      })
                    }
                  />
                </Stack>
              </FormControl>
            </Box>
          ) : null}

          {(mode === InitMode.initiator || mode === InitMode.participant) &&
          activeStep === 1 ? (
            <Box mt={2}>
              <FormControl>
                <FormLabel>
                  密钥是证明身份的唯一方式，用于去中心化网络的信息加密和数字签名。
                </FormLabel>
                <FormLabel>密钥在生成后请妥善保存，丢失后无法找回。</FormLabel>
                <RadioGroup
                  aria-labelledby="demo-radio-buttons-group-label"
                  value={key_mode}
                  row
                  name="radio-buttons-group"
                  onChange={(e) =>
                    set_initial_state({
                      ...initial_state,
                      key_mode: e.target.value,
                      peer_json_str: '',
                    })
                  }
                >
                  <FormControlLabel
                    value="new"
                    control={<Radio />}
                    label="创建新的密钥（随机生成）"
                  />
                  <FormControlLabel
                    value="load"
                    control={<Radio />}
                    label="使用已有的密钥"
                  />
                </RadioGroup>
                {key_mode === 'load' ? (
                  <input
                    type="file"
                    onChange={async (e) => {
                      try {
                        const content = await load_text_from_file_input(e);
                        peer.current = await PeerId.createFromJSON(
                          JSON.parse(content),
                        );
                        set_initial_state({
                          ...initial_state,
                          peer_json_str: content,
                        });
                      } catch (e) {
                        alert(e.toString());
                      }
                    }}
                  />
                ) : (
                  <Box>
                    <Button
                      variant="outlined"
                      onClick={async (e) => {
                        peer.current = await PeerId.create();
                        const str = JSON.stringify(peer.current.toJSON());
                        set_initial_state({
                          ...initial_state,
                          peer_json_str: str,
                        });

                        save_to_file('private_key', str);
                      }}
                    >
                      点击下载新的密钥
                    </Button>
                  </Box>
                )}
              </FormControl>
            </Box>
          ) : null}
          {mode === InitMode.participant && activeStep === 2 ? (
            <Box mt={2}>
              <DialogContentText>1. 联系推荐人</DialogContentText>
              <DialogContentText>
                2. 向推荐人提供公钥和个人信息
              </DialogContentText>
              <DialogContentText>3. 等待推荐人提交申请</DialogContentText>
              <DialogContentText>4. 等待议题通过</DialogContentText>
              <DialogContentText>
                5. 点击“下一步”同步区块并加入去中心化网络
              </DialogContentText>
            </Box>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0 || loading}
              onClick={() =>
                set_initial_state({
                  ...initial_state,
                  activeStep: activeStep - 1,
                })
              }
              sx={{ mr: 1 }}
            >
              上一步
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button
              disabled={
                loading ||
                (activeStep === 1 &&
                  (mode === InitMode.participant ||
                    mode === InitMode.initiator) &&
                  !peer_json_str)
              }
              onClick={async () => {
                if (mode === InitMode.initiator && activeStep === 3) {
                  const public_key = JSON.parse(peer_json_str).pubKey;
                  const [profile_a, profile_b]: Profile[] = [
                    {
                      name,
                      public_key,
                      proof_cid: id_proof,
                    },
                    {
                      name: bootstrap_name,
                      public_key: bootstrap_public_key,
                      proof_cid: bootstrap_id_proof,
                    },
                  ].sort((a, b) => (a.public_key > b.public_key ? 1 : -1));
                  initial_action_subjects.current = [
                    (
                      await PeerId.createFromPubKey(profile_a.public_key)
                    ).toB58String(),
                  ];
                  initial_action_bundle.current = get_initial_action_bundle(
                    profile_a,
                    profile_b,
                  );
                  try { // TODO 签名 a add b, b add a, 
                    signature.current = await RSA_sign(
                      peer.current.privKey,
                      encode([
                        initial_action_bundle[0],
                        AHEAD_OF_ROOT_BLOCK2,
                        initial_timestamp,
                      ]),
                    );
                  } catch (e) {
                    alert(e);
                  }
                } else if (mode === InitMode.initiator && activeStep === 4) {
                  const peer_json: PeerJSON = JSON.parse(peer_json_str);
                  const config: RIConfig = {
                    my_peer_json: peer_json,
                    bootstrap_public_key,
                  };
                  set_config(config);
                  const { port, p2p_address } = await post_init({
                    config,
                    initial_action_bundle: initial_action_bundle.current,
                    initial_action_subjects: initial_action_subjects.current,
                    initial_action_signatures:
                      initial_action_subjects.current[0] === peer_json.id
                        ? [signature.current]
                        : [b64_to_uint8array(bootstrap_signature)],
                    initial_timestamp,
                    initial_min_actions_broadcast_window: 10,
                    initial_min_witness_broadcast_window: 10,
                  });
                  set_initial_state((state) => ({
                    ...state,
                    p2p_addr: p2p_address,
                  }));
                } else if (mode === InitMode.initiator && activeStep === 5) {
                  await connect_to_peer(bootstrap_addr);
                }
                if (activeStep === steps[mode].length - 1) {
                  location.reload();
                } else {
                  set_initial_state((state) => ({
                    ...state,
                    activeStep: activeStep + 1,
                  }));
                }
              }}
            >
              {activeStep === steps[mode].length - 1 ? '确定' : '下一步'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dashboard hidden={!ready} />
    </React.Fragment>
  );
};

ReactDOM.render(<Main />, document.getElementById('root'));
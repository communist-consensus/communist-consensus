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
        name: '??????',
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
      initiator: ['?????????????????????', '????????????', '?????????????????????', '???????????????????????????', '??????????????????', '?????? P2P ??????'],
      participant: [
        '?????????????????????',
        '??????????????????????????????',
        '??????????????????',
        '????????????',
      ],
      reviewer: ['?????????????????????', '????????????'],
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
        <DialogTitle id="scroll-dialog-title">??????????????????????????????</DialogTitle>
        <DialogContent dividers={true}>
          <FormLabel>?????????????????????</FormLabel>
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
          ?????????????????????????????????
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
                    label="???????????????????????????????????????????????????????????????????????????"
                  />
                  <FormControlLabel
                    value="participant"
                    control={<Radio />}
                    label="????????????????????????????????????"
                  />
                  <FormControlLabel
                    value="reviewer"
                    control={<Radio />}
                    label="???????????????????????????????????????????????????????????????"
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          ) : null}

          {mode === InitMode.initiator && activeStep === 5 ? (
            <Box mt={2}>
                <Stack spacing={1}>
                  <FormLabel>?????? P2P ??????</FormLabel>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    divider={<Divider orientation="vertical" flexItem />}
                  >
                    <TextField
                      label="??????P2P??????"
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
                      label="?????????P2P??????"
                      defaultValue={bootstrap_addr}
                      placeholder="????????? /ip4/127.0.0.1/tcp/36491/p2p/xxx"
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
                ??????????????????????????????????????????????????????????????????????????????
              </FormLabel>
              <Stack
                direction="row"
                spacing={2}
                divider={<Divider orientation="vertical" flexItem />}
              >
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <TextField
                    label="??????????????????????????????"
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
                    label="??????????????????"
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
                    label="????????????"
                    fullWidth
                    multiline
                    disabled
                    defaultValue={JSON.parse(peer_json_str).pubKey}
                    variant="outlined"
                  />
                </Stack>
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <TextField
                    label="?????????????????????????????????"
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
                    label="?????????????????????"
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
                    label="???????????????"
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
                  <FormLabel>????????????????????????????????????</FormLabel>
                  <Stack
                    direction="row"
                    spacing={2}
                    justifyContent="space-between"
                    divider={<Divider orientation="vertical" flexItem />}
                  >
                    <TextField
                      label="??????????????????"
                      fullWidth
                      disabled
                      multiline
                      value={uint8array_to_b64(signature.current)}
                      variant="outlined"
                    />
                    <TextField
                      label="?????????????????????"
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
                    ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
                  </FormLabel>
                  <FormLabel>
                    ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
                  </FormLabel>
                  <FormLabel>
                    ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
                  </FormLabel>
                  <TextField
                    label="??????????????????"
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
                  ????????????????????????????????????????????????????????????????????????????????????????????????
                </FormLabel>
                <FormLabel>????????????????????????????????????????????????????????????</FormLabel>
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
                    label="????????????????????????????????????"
                  />
                  <FormControlLabel
                    value="load"
                    control={<Radio />}
                    label="?????????????????????"
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
                      ????????????????????????
                    </Button>
                  </Box>
                )}
              </FormControl>
            </Box>
          ) : null}
          {mode === InitMode.participant && activeStep === 2 ? (
            <Box mt={2}>
              <DialogContentText>1. ???????????????</DialogContentText>
              <DialogContentText>
                2. ???????????????????????????????????????
              </DialogContentText>
              <DialogContentText>3. ???????????????????????????</DialogContentText>
              <DialogContentText>4. ??????????????????</DialogContentText>
              <DialogContentText>
                5. ????????????????????????????????????????????????????????????
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
              ?????????
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
                  try { // TODO ?????? a add b, b add a, 
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
              {activeStep === steps[mode].length - 1 ? '??????' : '?????????'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dashboard hidden={!ready} />
    </React.Fragment>
  );
};

ReactDOM.render(<Main />, document.getElementById('root'));
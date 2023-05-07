import React, { useEffect, useState } from 'react';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Input from '@mui/material/Input';
import {
  commit_actions,
  get_domains,
  get_latest_block,
  get_peers,
  get_proposal,
  get_proposals,
  get_solution,
  get_sub_domains,
  ipfs_get,
} from './utils';
import {
  ActionMakeProposal,
  ActionType,
  CommonProposal,
  CommonSolution,
  DBDomainProposalPair,
  DBPeer,
  IProposalStore,
  DBSolution,
  DBTask,
  DomainEntity,
  DomainID,
  ProposalStatus,
  VITask,
  VITaskType,
} from '../shared/types';

import Solution from './Solution';
import DomainPicker from './DomainPicker';
import { ExtendedDomain, WindowUnit } from './types';
import WindowTimePicker from './WindowTimePicker';
import Proposal from './Proposal';
import PeerPicker from './PeerPicker';

const NewTaskDialog = (props: {
  show: boolean;
  onConfirm: (task: VITask) => void;
  onClose: Function;
}) => {
  const [task, set_task] = useState<Partial<VITask>>({
    type: VITaskType.AssignToEntity,
  });
  return (
    <Dialog
      open={props.show}
      fullWidth
      scroll={'paper'}
      aria-labelledby="scroll-dialog-title"
      aria-describedby="scroll-dialog-description"
    >
      <DialogTitle>新增任务</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Select
            value={task.type}
            variant="standard"
            onChange={(e) => {
              set_task({ type: parseInt(e.target.value as string) });
            }}
          >
            <MenuItem value={VITaskType.AssignToEntity}>指派代表</MenuItem>
            <MenuItem value={VITaskType.PeerAdd}>新增成员</MenuItem>
            <MenuItem value={VITaskType.PeerDelete}>删除成员</MenuItem>
            <MenuItem value={VITaskType.DomainAdd}>新增领域</MenuItem>
            <MenuItem value={VITaskType.DomainMerge}>合并领域</MenuItem>
            <MenuItem value={VITaskType.DomainModify}>领域重命名</MenuItem>
            <MenuItem value={VITaskType.SelfUpgrade}>升级决策系统</MenuItem>
          </Select>
          {task.type === VITaskType.AssignToEntity ? (
            <PeerPicker
              onChange={(peer) => {
                set_task({
                  type: VITaskType.AssignToEntity,
                  mid: peer.id,
                });
              }}
            />
          ) : null}
          {task.type === VITaskType.SelfUpgrade ? (
            <TextField
              defaultValue=""
              placeholder="脚本"
              onChange={(e) =>
                set_task({
                  type: VITaskType.SelfUpgrade,
                  script: e.target.value,
                })
              }
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>取消</Button>
        <Button
          onClick={() => {
            props.onConfirm(task as VITask);
          }}
        >
          确定
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewTaskDialog;


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
import { commit_actions, get_domains, get_latest_block, get_proposal, get_proposals, get_solution, get_sub_domains, ipfs_get } from './utils';
import { ActionMakeProposal, ActionType, CommonProposal, CommonSolution, DBDomainProposalPair, DBProposal, DBSolution, DBTask, DomainEntity, DomainID, ProposalStatus, VITask, VITaskType } from '../shared/types';

import Solution from './Solution';
import DomainPicker from './DomainPicker';
import { ExtendedDomain, WindowUnit } from './types';

const WindowTimePicker = (props: {
  label: string,
  window_unit: WindowUnit,
  value: number,
  onChange: Function,
}) => {

  return (
    <Stack justifyContent="space-between" direction="row">
      <DialogContentText>{props.label}</DialogContentText>
      <Stack sx={{ width: 100 }} direction="row">
        <Input
          type="number"
          value={props.value}
          onChange={(e) =>
            props.onChange(parseInt(e.target.value), props.window_unit)
          }
        />
        <Select
          value={props.window_unit}
          variant="standard"
          onChange={(e) => props.onChange(props.value, e.target.value)}
        >
          <MenuItem value={WindowUnit.minutes}>分钟</MenuItem>
          <MenuItem value={WindowUnit.hours}>小时</MenuItem>
          <MenuItem value={WindowUnit.days}>天</MenuItem>
        </Select>
      </Stack>
    </Stack>
  );
}

export default WindowTimePicker;
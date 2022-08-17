
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
import { commit_actions, get_domains, get_latest_block, get_peers, get_proposal, get_proposals, get_solution, get_sub_domains, ipfs_get } from './utils';
import { ActionMakeProposal, ActionType, CommonProposal, CommonSolution, DBDomainProposalPair, DBPeer, DBProposal, DBSolution, DBTask, DomainEntity, DomainID, ProposalStatus, VITask, VITaskType } from '../shared/types';

import Solution from './Solution';
import DomainPicker from './DomainPicker';
import { ExtendedDomain, WindowUnit } from './types';
import WindowTimePicker from './WindowTimePicker';
import Proposal from './Proposal';
const PeerPicker = (props: { onChange: (peer: DBPeer) => void }) => {
  const [peers, set_peers] = useState<DBPeer[]>([]);
  useEffect(() => {
    (async () => {
      const peers = await get_peers(1);
      set_peers(peers);
      if (peers.length) {
        props.onChange(peers[0]);
      }
    })();
  }, []);
  return (
    <Stack>
      <Typography>选择成员</Typography>
      {peers.length ? (
        <Select
          defaultValue={peers[0].id}
          variant="standard"
          onChange={(e) => {
            props.onChange(peers.find((i) => i.id === e.target.value));
          }}
        >
          {peers.map((peer) => (
            <MenuItem key={peer.id} value={peer.id}>
              {peer.name}
            </MenuItem>
          ))}
        </Select>
      ) : null}
    </Stack>
  );
};

export default PeerPicker;
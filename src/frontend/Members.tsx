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
import { commit_actions, get_domains, get_latest_block, get_peers, get_proposal, get_proposals, get_sub_domains, ipfs_get } from './utils';
import { ActionMakeProposal, ActionType, CommonProposal, CommonSolution, DBDomainProposalPair, DBPeer, DBProposal, DomainEntity, DomainID, PeerStatus, ProposalStatus, VITask, VITaskType } from '../shared/types';

export const Members = () => {
  const [members, set_members] = useState<DBPeer[]>([]);
  const [page, set_page] = useState(1);

  useEffect(() => {
    (async() => {
      set_members(await get_peers(page));
    })();
  }, [page]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={12} lg={12}>
        <Paper
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack>
            <Stack mt={1} direction="row" justifyContent="space-between">
              <Typography variant="h5">成员列表</Typography>
            </Stack>
            <Stack sx={{mt: 2}} spacing={1}>
              {members.map(member => <Member key={member.id} peer={member}/>)}
            </Stack>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
};

const Member =({peer }: {peer: DBPeer}) => {
  const [content, set_content] = useState('');
  useEffect(() => {
    (async () => {
      set_content(await ipfs_get<string>(peer.proof_cid));
    })();
  }, []);
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ width: '100%' }}
          spacing={2}
        >
          <Typography sx={{ flex: 1 }}>{peer.name}</Typography>
          <Typography>id：{peer.id}</Typography>
          <Typography>状态：{PeerStatus[peer.status]}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Typography>描述：{content}</Typography>
      </AccordionDetails>
    </Accordion>
  );
}
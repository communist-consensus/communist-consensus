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
import WindowTimePicker from './WindowTimePicker';
import Proposal from './Proposal';

export const Publicity = () => {
  const [domain, set_domain] = useState({
    id: undefined,
    page: undefined,
  });
  const [proposals, set_proposals] = useState<DBDomainProposalPair[]>([]);

  useEffect(() => {
    (async() => {
      const { proposals } = await get_proposals(domain.id, domain.page);
      set_proposals(proposals.filter(i => i.proposal_status === ProposalStatus.publicizing));
    })();
  }, [domain]);

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
          <DomainPicker
            onChange={(domain: ExtendedDomain) => {
              set_domain({id: domain.id, page: 1});
            }}
          />
          <Stack>
            <Stack mt={1} direction="row" justifyContent="space-between">
              <Typography variant="h5">公示</Typography>
            </Stack>
            <Stack sx={{mt: 2}} spacing={1}>
              {proposals.map(proposal => <Proposal key={proposal.proposal_id} id={proposal.proposal_id}/>)}
            </Stack>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
};


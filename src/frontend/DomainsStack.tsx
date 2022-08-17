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

import { ExtendedDomain } from './types';
import Solution from './Solution';

export const DomainsStack = (props: {
  domains: ExtendedDomain[];
  total_depth: number;
  selected: DomainID;
  select_domain: (domain_id: DomainID, depth: number) => Promise<void>;
  depth: number;
}) => {
  return (
    <Stack spacing={1} direction="row" mt={1}>
      {props.domains.map((domain) => (
        <Chip
          key={domain.id}
          label={domain.path || domain.name}
          color="primary"
          size="small"
          variant={props.selected === domain.id && props.total_depth === props.depth ? 'filled' : 'outlined'}
          onClick={() => {
            props.select_domain(domain.id, props.depth);
          }}
        />
      ))}
    </Stack>
  );
};

export default DomainsStack;
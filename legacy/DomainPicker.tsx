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
  IProposalStore,
  DBSolution,
  DBTask,
  DomainEntity,
  DomainID,
  ProposalStatus,
  VITask,
  VITaskType,
} from '../shared/types';

import { ExtendedDomain } from './types';
import DomainsStack from './DomainsStack';

export const DomainPicker = (props: { onChange: Function }) => {
  const [selected, set_selected] = useState('');
  const [domains_stack, set_domains_stack] = useState<
    {
      domains: ExtendedDomain[];
      total: number;
      n: number;
    }[]
  >([]);

  async function select_domain(domain_id: DomainID, depth: number) {
    const first = domains_stack[domains_stack.length - 1].domains[0];
    set_selected(domain_id);
    if (first.id === domain_id && first.virtual) {
      return;
    }
    const res = await get_sub_domains(domain_id, 1);
    const parent = domains_stack[depth].domains.find((i) => i.id === domain_id)!;
    res.domains.forEach((domain) => {
      (domain as ExtendedDomain).path = `${parent.path || parent.name}/${
        domain.name
      }`;
    });
    if (res.domains.length) {
      (res.domains as ExtendedDomain[]).unshift({
        parent_id: '',
        name: '综合',
        path: (parent.path || parent.name) + '/综合',
        id: domain_id,
        virtual: true,
      });
      set_domains_stack([...domains_stack.slice(0, depth + 1), res]);
    } else {
      props.onChange(parent);
      set_domains_stack([...domains_stack.slice(0, depth + 1)]);
    }
  }

  useEffect(() => {
    (async function () {
      if (!domains_stack.length) {
        return;
      }
      const idx = domains_stack.length - 1;
      let extended_domain: ExtendedDomain;
      for (const domain of domains_stack[idx].domains) {
        if (domain.id === selected) {
          extended_domain = domain;
        }
      }
      if (!extended_domain!) {
        await select_domain(domains_stack[idx].domains[0].id, idx);
      } else {
        props.onChange(extended_domain);
      }
    })();
  }, [domains_stack]);

  useEffect(() => {
    (async function () {
      set_domains_stack([await get_domains(1)]);
    })();
  }, []);

  return (
    <React.Fragment>
      {domains_stack.map((i, idx) => (
        <Stack
          key={`${i.domains[0].id} ${idx}`}
          spacing={1}
          direction="column"
          mt={1}
        >
          <DomainsStack
            total_depth={domains_stack.length - 1}
            domains={i.domains}
            selected={selected}
            select_domain={select_domain}
            depth={idx}
          />
          <Divider light />
        </Stack>
      ))}
    </React.Fragment>
  );
};

export default DomainPicker;

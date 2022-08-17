
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
import NewTaskDialog from './NewTaskDialog';

export const NewProposalDialog = (props: {
  show: boolean,
  onClose: Function,
}) => {
  const [title, set_title] = useState('');
  const [description, set_description] = useState('');
  const [new_proposal, set_new_proposal] = useState({
    n_participant: 20,
    meeting_window: 24,
    meeting_window_unit: WindowUnit.hours,
  });

  const [solution, set_solution] = useState<CommonSolution>({
    content_cid: '',
    tasks: [],
  });

  const [show_new_task_dialog, set_show_new_task_dialog] = useState(false);
  const [domain_picker, set_domain_picker] = useState<{
    show: boolean;
    selected_domain?: ExtendedDomain,
    domains: ExtendedDomain[];
  }>({
    show: false,
    domains: [],
  });

  return (
    <Dialog
      open={props.show}
      onClose={() => props.onClose()}
      fullWidth
      scroll={'paper'}
      aria-labelledby="scroll-dialog-title"
      aria-describedby="scroll-dialog-description"
    >
      <DialogTitle>发起议题</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mb={2} mt={1}>
          <TextField
            label="标题"
            defaultValue=""
            onChange={(e) => set_title(e.target.value)}
          />
          <TextField
            label="议题描述"
            defaultValue=""
            multiline
            onChange={(e) => set_description(e.target.value)}
          />
          <WindowTimePicker
            label="期望每一轮会议时间"
            value={new_proposal.meeting_window}
            window_unit={new_proposal.meeting_window_unit}
            onChange={(value: number, unit: WindowUnit) =>
              set_new_proposal({
                ...new_proposal,
                meeting_window: value,
                meeting_window_unit: unit,
              })
            }
          />
          <Stack justifyContent="space-between" direction="row">
            <DialogContentText>期望每一轮会议容量</DialogContentText>
            <Stack sx={{ width: 100 }} direction="row">
              <Input
                type="number"
                value={new_proposal.n_participant}
                onChange={(e) =>
                  set_new_proposal({
                    ...new_proposal,
                    n_participant: parseInt(e.target.value),
                  })
                }
              />
              <DialogContentText>人</DialogContentText>
            </Stack>
          </Stack>
          <DialogContentText>所属领域</DialogContentText>
          <Stack direction="row" spacing={1}>
            {domain_picker.domains.map((domain, idx) => (
              <Chip
                label={domain.path || domain.name}
                key={domain.id}
                variant="outlined"
                color="primary"
                size="small"
                onDelete={() => {
                  domain_picker.domains.splice(idx, 1);
                  set_domain_picker({
                    ...domain_picker,
                  });
                }}
              />
            ))}
            <Chip
              label="+"
              size="small"
              color="primary"
              variant="filled"
              onClick={() => {
                set_domain_picker({ ...domain_picker, show: true });
              }}
            />
            <NewTaskDialog
              show={show_new_task_dialog}
              onClose={() => set_show_new_task_dialog(false)}
              onConfirm={(task) => {
                set_show_new_task_dialog(false);
                set_solution((state) => ({
                  ...state,
                  tasks: [...state.tasks, task],
                }));
              }}
            />
            <Dialog
              open={domain_picker.show}
              fullWidth
              scroll={'paper'}
              aria-labelledby="scroll-dialog-title"
              aria-describedby="scroll-dialog-description"
            >
              <DialogTitle>选择领域</DialogTitle>
              <DialogContent>
                <DomainPicker
                  onChange={(domain: ExtendedDomain) =>
                    set_domain_picker({
                      ...domain_picker,
                      selected_domain: domain,
                    })
                  }
                />
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() =>
                    set_domain_picker({ ...domain_picker, show: false })
                  }
                >
                  关闭
                </Button>
                <Button
                  onClick={() =>
                    set_domain_picker({
                      ...domain_picker,
                      domains: domain_picker.domains.find(
                        (i) => i.id === domain_picker.selected_domain.id,
                      )
                        ? domain_picker.domains
                        : [
                            ...domain_picker.domains,
                            domain_picker.selected_domain,
                          ],
                      show: false,
                    })
                  }
                  autoFocus
                >
                  确定
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
        </Stack>
        <Divider light />
        <Stack spacing={2} mt={2}>
          <DialogContentText>默认解决方案</DialogContentText>
          <TextField label="方案描述" multiline />
          <Stack spacing={1} divider={<Divider />}>
            {solution.tasks.map((task, idx) => (
              <Stack key={Math.random()} direction="row">
                <Typography>
                  任务{idx + 1}：{VITaskType[task.type]}
                </Typography>
                <Button>删除</Button>
              </Stack>
            ))}
            <Button onClick={() => set_show_new_task_dialog(true)}>
              新增任务
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>关闭</Button>
        <Button
          onClick={async () => {
            const proposal: CommonProposal = {
              title,
              content_cid: description,
              domain_ids: [domain_picker.selected_domain.id],
              properties: {
                max_n_proposer: new_proposal.n_participant,
                discussion_voting_duration:
                  new_proposal.meeting_window *
                  (new_proposal.meeting_window_unit === WindowUnit.days
                    ? 3600 * 24
                    : new_proposal.meeting_window_unit === WindowUnit.hours
                    ? 3600
                    : 60),
              },
              default_solution: solution,
            };
            const action: ActionMakeProposal = {
              type: ActionType.MakeProposal,
              proposal,
            };
            await commit_actions([action]);
          }}
          autoFocus
        >
          确定
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewProposalDialog;
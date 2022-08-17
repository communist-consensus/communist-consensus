
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
import { commit_actions, get_conferences, get_domains, get_latest_block, get_proposal, get_proposals, get_solution, get_solutions, get_sub_domains, ipfs_add, ipfs_get, readable_timestamp } from './utils';
import { ActionMakeProposal, ActionType, CommonProposal, CommonSolution, DBConference, DBConferenceSolutionPair, DBDomainProposalPair, DBProposal, DBSolution, DBTask, DomainEntity, DomainID, ProposalStatus, VITask, VITaskType } from '../shared/types';

import Solution from './Solution';
import DomainPicker from './DomainPicker';
import { ExtendedDomain } from './types';
import NewTaskDialog from './NewTaskDialog';
const Proposal=({id}: {id: string}) => {
  const [proposal, set_proposal] = useState<DBProposal>(undefined);
  const [new_solution, set_new_solution] = useState<{
    show: boolean;
    content: string;
    tasks: VITask[];
  }>({
    show: false,
    content: '',
    tasks: [],
  });
  const [content, set_content] = useState('');
  const [show_new_solution, set_show_new_solution] = useState(false);
  useEffect(() => {
    (async () => {
      const { proposal } = await get_proposal(id);
      set_proposal(proposal);
      set_content(await ipfs_get<string>(proposal.content_cid));
    })();
  }, []);
  if (!proposal) {
    return null;
  }
  return (
    <React.Fragment>
      <NewSolutionDialog show={show_new_solution} onClose={() => set_show_new_solution(false)}/>
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ width: '100%' }}
            spacing={2}
          >
            <Typography sx={{ flex: 1 }}>{proposal.title}</Typography>
            <Typography>状态：{ProposalStatus[proposal.status]}</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>议题id：{proposal.id}</Typography>
          <Typography>描述：{content}</Typography>
          <Typography>发起者：{proposal.originator_id}</Typography>
          <Typography>
            发起时间：{readable_timestamp(proposal.make_proposal_timestamp)}
          </Typography>
          <Typography>参与人数：{proposal.computed_n_participant}</Typography>
          <Typography>
            最大子会议人数：{proposal.computed_max_n_proposer}
          </Typography>
          <Typography>已进行{proposal.computed_n_round}轮会议</Typography>
          <Typography>
            （预计）会议结束时间：
            {readable_timestamp(proposal.computed_discussion_voting_end)}
          </Typography>
          <Typography>
            （预计）公示期结束时间：
            {readable_timestamp(proposal.computed_publicity_end)}
          </Typography>
          <Divider light/>
          {proposal.computed_final_solution_id ? (
            <Stack>
              <Typography>最终解决方案：</Typography>
              <Solution id={proposal.computed_final_solution_id} proposal_id={proposal.id} conference_id={proposal.computed_final_conference_id}/>
            </Stack>
          ) : null}
          <Divider light/>
          <ConferenceSelect n_round={proposal.computed_n_round} proposal_id={proposal.id}/>
          {proposal.status === ProposalStatus.discussing_voting ? (
            <Button onClick={() => set_show_new_solution(true)}>新增解决方案</Button>
          ) : null}
        </AccordionDetails>
      </Accordion>
    </React.Fragment>
  );
}

const ConferenceSelect = (props:{n_round: number, proposal_id: string}) => {
  const [round, set_round] = useState(props.n_round);
  const [page, set_page] = useState(1);
  const [conferences, set_conferences] = useState<DBConference[]>([]);
  const [solutions, set_solutions] = useState<DBConferenceSolutionPair[]>([]);
  const [selected_conference, set_selected_conference] = useState('');

  async function update_conferences() {
    const conferences = await get_conferences(props.proposal_id, round, page);
    set_conferences(conferences);
    if (conferences.length) {
      set_selected_conference(conferences[0].id);
    }
  }
  useEffect(() => {
    (async () => {
      await update_conferences();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await update_conferences();
    })();
  }, [round]);

  useEffect(() => {
    (async () => {
      if (!selected_conference) {
        return;
      }
      const solutions = await get_solutions(props.proposal_id, round, selected_conference, page);
      set_solutions(solutions);
    })();
  }, [selected_conference]);

  return (
    <Stack>
      <Stack>
        <Typography>候选解决方案：</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Select
            defaultValue={round}
            variant="standard"
            onChange={(e) => {
              set_round(parseInt(e.target.value as string));
            }}
          >
            {new Array(props.n_round).fill(0).map((i, idx) => (
              <MenuItem key={idx + 1} value={idx + 1}>
                第{idx + 1}轮
              </MenuItem>
            ))}
          </Select>
          <Typography>会议ID：</Typography>
          <Select
            value={selected_conference}
            variant="standard"
            onChange={(e) => {
              set_selected_conference(e.target.value as string);
            }}
          >
            {conferences.map((conference) => (
              <MenuItem key={conference.id} value={conference.id}>
                {conference.id}
              </MenuItem>
            ))}
          </Select>
        </Stack>
        <Stack>
          {solutions.map((solution) => (
            <Solution key={solution.solution_id} id={solution.solution_id} proposal_id={props.proposal_id} conference_id={selected_conference}/>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
};

const NewSolutionDialog = (props: {
  show: boolean,
  onClose: Function,
}) => {
  const [description, set_description] = useState('');
  const [show_new_task_dialog, set_show_new_task_dialog] = useState(false);
  const [solution, set_solution] = useState<CommonSolution>({
    content_cid: '',
    tasks: [],
  });
  return (
    <Dialog
      open={props.show}
      onClose={() => props.onClose()}
      fullWidth
      scroll={'paper'}
    >
      <DialogTitle>新增解决方案</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mb={2} mt={1}>
          <TextField
            label="方案描述"
            defaultValue=""
            multiline
            onChange={(e) => set_description(e.target.value)}
          />
        </Stack>
        <Divider light />
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
        <Stack spacing={2} mt={2}>
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
            <Button
              onClick={() => {
                set_show_new_task_dialog(true);
              }}
            >
              新增任务
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>关闭</Button>
        <Button onClick={async () => {
          const new_solution: CommonSolution = {
            content_cid: await ipfs_add(description),
            tasks: solution.tasks,
          };
          // TODO
        }} autoFocus>
          确定
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default Proposal;
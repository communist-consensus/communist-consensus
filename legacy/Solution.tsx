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
  comment_solution,
  commit_actions,
  get_domains,
  get_latest_block,
  get_peer,
  get_proposal,
  get_proposals,
  get_solution,
  get_solution_votes,
  get_sub_domains,
  has_vote_solution,
  ipfs_add,
  ipfs_get,
  vote_solution,
} from './utils';
import {
  ActionMakeProposal,
  ActionType,
  CommonProposal,
  CommonSolution,
  DBDomainProposalPair,
  IProposalStore,
  DBSolution,
  DBSolutionComment,
  DBTask,
  DomainEntity,
  DomainID,
  ProposalStatus,
  VIAssignToEntity,
  VISelfUpgrade,
  VITask,
  VITaskType,
} from '../shared/types';
import { decode } from '../shared/utils';
import { Buffer } from 'buffer';

const Solution = ({
  id,
  proposal_id,
  conference_id,
}: {
  id: string;
  proposal_id: string;
  conference_id: string;
}) => {
  const [solution, set_solution] = useState<DBSolution>(undefined);
  const [tasks, set_tasks] = useState<DBTask[]>([]);
  const [votes, set_votes] = useState<number>(undefined);
  const [content, set_content] = useState('');
  const [voted, set_voted] = useState<boolean>(undefined);
  const [comments, set_comments] = useState<DBSolutionComment[]>([]);
  useEffect(() => {
    (async () => {
      const { solution, tasks, comments } = await get_solution(id);
      set_solution(solution);
      set_tasks(tasks);
      set_content(await ipfs_get<string>(solution.content_cid));
      const votes = await get_solution_votes(proposal_id, conference_id, id);
      set_votes(votes);
      set_voted(await has_vote_solution(proposal_id, conference_id, id));
      set_comments(comments);
    })();
  }, []);
  if (!solution) {
    return null;
  }
  return (
    <Stack direction="row" spacing={2}>
      <Accordion disableGutters sx={{ flex: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ width: '100%' }}
            spacing={2}
          >
            <Typography sx={{ flex: 1 }}>{content}</Typography>
            <Typography>票数：{votes != undefined ? votes : '...'}</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {tasks.map((task) => (
            <Task key={task.id} task={task} />
          ))}
          <Stack>
            <Stack justifyContent="space-between" direction="row">
              <Typography>评论</Typography>
              <Button
                onClick={async () => {
                  const text = prompt('新增评论');
                  if (!text) {
                    return;
                  }
                  const cid = await ipfs_add(text);
                  await comment_solution(proposal_id, conference_id, id, cid);
                }}
              >
                新增评论
              </Button>
            </Stack>
            {comments.map((i) => (
              <Comment key={i.id} comment={i} />
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
      {voted != undefined ? (
        <Button
          variant="outlined"
          onClick={async () => {
            if (voted) {
              return;
            }
            await vote_solution(proposal_id, conference_id, id);
          }}
        >
          {voted ? '已投票' : '附议'}
        </Button>
      ) : null}
    </Stack>
  );
};

const Task = ({ task }: { task: DBTask }) => {
  const [content, set_content] = useState('');
  useEffect(() => {
    (async () => {
      const vitask = decode<VITask>(task.args);
      if (task.type === VITaskType.SelfUpgrade) {
        set_content((vitask as VISelfUpgrade).script);
      } else if (task.type === VITaskType.AssignToEntity) {
        set_content((await get_peer((vitask as VIAssignToEntity).mid)).name);
      }
    })();
  }, []);
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography>任务类型:{VITaskType[task.type]}</Typography>
      <Typography>
        任务内容:
        <Chip label={content} />
      </Typography>
    </Stack>
  );
};

const Comment = ({ comment }: { comment: DBSolutionComment }) => {
  const [content, set_content] = useState('');
  const [name, set_name] = useState('');
  useEffect(() => {
    (async () => {
      set_content(await ipfs_get(comment.content_cid));
      set_name((await get_peer(comment.peer_id)).name);
    })();
  }, []);
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography>{name}</Typography>
      <Typography>{content}</Typography>
    </Stack>
  );
};

export default Solution;

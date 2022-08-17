import React, { useEffect, useState } from 'react';
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
import { get_block, get_pending_block } from '../utils';
import { BlockContext, BlockCtxState, BlockTimestamps, DBBlock, IPFSAddress } from '../../shared/types';
import { compute_actions_broadcast_duration, compute_witness_broadcast_duration, get_bucket_node, get_now } from '../../shared/utils';
import { AHEAD_OF_ROOT_BLOCK } from '../../shared/constant';

enum KeypointType {
  actions_broadcast,
  witness_broadcast_delay,
  witness_broadcast,
  witness_broadcast_delay_last_one,
  idle,
}
type Keypoint = {
  type: KeypointType,
  start: number,
  end: number,
}
type ExtendedBlock = BlockTimestamps & {
  block_hash?: IPFSAddress,
  prev_block_hash?: IPFSAddress,
  n_peer: number,
  state: BlockCtxState,
  cycle_id: number;
  keypoints: Keypoint[];
};

function get_keypoints(
  block: BlockContext | (DBBlock & { state: BlockCtxState }),
  prev_witness_broadcast_window_end: number,
  now: number,
) {
  const keypoints: Keypoint[] = [];
  keypoints.push({
    type: KeypointType.actions_broadcast,
    start: block.actions_broadcast_window_start,
    end: block.actions_broadcast_window_end,
  });
  if (
    block.state === BlockCtxState.witness_broadcast_start ||
    block.state === BlockCtxState.witness_broadcast_end
  ) {
    if (
      block.state === BlockCtxState.witness_broadcast_start &&
      block.witness_broadcast_window_start >= now
    ) {
      return keypoints;
    }
    let time =
      block.state === BlockCtxState.witness_broadcast_start
        ? now - 1
        : block.witness_broadcast_window_end - 1;
    let delay;
    let temp: {
      n_tries: number;
      witness_broadcast_duration: number;
      witness_broadcast_window_start: number;
      estimated_time_error: number;
      estimated_transmission_duration: number;
    };
    let last_one: Keypoint;
    do {
      temp = compute_witness_broadcast_duration(
        block.min_witness_broadcast_window,
        block.n_peer,
        prev_witness_broadcast_window_end,
        time,
      );
      if (delay === undefined) {
        delay = block.state === BlockCtxState.witness_broadcast_end && temp.n_tries === 0 ? false : true;
      }
      if (isNaN(temp.witness_broadcast_window_start)) {
        debugger;
      }
      const keypoint: Keypoint = {
        type: delay
          ? KeypointType.witness_broadcast_delay
          : KeypointType.witness_broadcast,
        start: temp.witness_broadcast_window_start,
        end:
          temp.witness_broadcast_window_start +
          temp.witness_broadcast_duration +
          temp.estimated_transmission_duration +
          2 * temp.estimated_time_error,
      };
      if (!last_one) {
        last_one = keypoint;
      }
      keypoints.push(keypoint);
      time = temp.witness_broadcast_window_start - 1;
    } while (temp.n_tries > 0);
    if (last_one && last_one.type === KeypointType.witness_broadcast_delay) {
      last_one.type = KeypointType.witness_broadcast_delay_last_one;
    }
  } else if (block.state === BlockCtxState.actions_broadcast_end) {
    keypoints.push({
      type: KeypointType.idle,
      start: block.actions_broadcast_window_end,
      end: now,
    });
  }
  return keypoints;
}

const block_height = 10;

const to_extended_blocks = (
  blocks: DBBlock[],
  prev_witness_broadcast_window_end: number,
): ExtendedBlock[] => {
  const now = get_now();
  return blocks.map((block, idx) => ({
    ...block,
    state: BlockCtxState.witness_broadcast_end,
    keypoints: get_keypoints(
      {
        ...block,
        state: BlockCtxState.witness_broadcast_end,
      },
      idx === 0
        ? prev_witness_broadcast_window_end
        : blocks[idx - 1].witness_broadcast_window_end,
      now,
    ),
  }));
}

export const Timeline = (props: {
  blocks?: DBBlock[],
  prev_witness_broadcast_window_end?: number,
}) => {
  const initial_blocks = props.blocks ? to_extended_blocks(props.blocks, props.prev_witness_broadcast_window_end) : [];
  const [state, set_state] = useState<{
    blocks: ExtendedBlock[];
    now: number;
  }>({
    blocks: [],
    now: get_now(),
  });
  const blocks = props.blocks ? initial_blocks : state.blocks;
  const { now } = state;
  useEffect(() => {
    let is_fetching = false;
    async function update_blocks() {
      const { pending_block: block_ctx, time: now } = await get_pending_block();

      const new_blocks: ExtendedBlock[] = [
        {
          ...block_ctx.prev,
          keypoints: get_keypoints(
            block_ctx.prev,
            block_ctx.prev.prev_block_hash === AHEAD_OF_ROOT_BLOCK
              ? 0
              : (await get_block(block_ctx.prev.prev_block_hash))
                  .witness_broadcast_window_end,
            now,
          ),
        },
        {
          ...block_ctx,
          keypoints: get_keypoints(
            block_ctx,
            block_ctx.prev.witness_broadcast_window_end,
            now,
          ),
        },
        {
          ...block_ctx.next,
          keypoints: get_keypoints(
            block_ctx.next,
            block_ctx.witness_broadcast_window_end,
            now,
          ),
        },
      ];
      console.log(new_blocks);
      set_state({
        now,
        blocks: new_blocks,
      });
      is_fetching = false;
    };
    if (!props.blocks) {
      // const interval = setInterval(() => {
      //   if (!is_fetching) {
      //     update_blocks();
      //   }
      // }, 1000);
      // return () => clearInterval(interval);
    }
  },[]);

  let timeline_min: number = Infinity;
  let timeline_max: number = 0;
  const marks = new Set<number>();
  blocks.forEach((block) =>
    block.keypoints.forEach((keypoint) => {
      marks.add(keypoint.start);
      marks.add(keypoint.end);
      timeline_max = Math.max(timeline_max, keypoint.start, keypoint.end);
      timeline_min = Math.min(timeline_min, keypoint.start, keypoint.end);
    }),
  );
  console.log(blocks);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#eee',
        height: blocks.length * block_height,
      }}
    >
      {blocks.map((block, idx) => (
        <BlockComponent
          key={block.block_hash || Math.random()}
          block={block}
          top={idx / blocks.length}
          timeline_max={timeline_max}
          timeline_min={timeline_min}
        />
      ))}
      {Array.from(marks).map((mark) => (
        <Mark
          key={mark}
          time={mark}
          timeline_max={timeline_max}
          timeline_min={timeline_min}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          width: 1,
          height: '100%',
          background: 'white',
          boxShadow: '0px 0 3px #868686',
          left: `${(
            ((now - timeline_min) * 100) /
            (timeline_max - timeline_min)
          ).toFixed(2)}%`,
        }}
      />
    </div>
  );
};

function ensure_two_chars(n: number) {
  return n < 10 ? `0${n}` : n;
}

const Mark = (props: {
  time: number;
  timeline_max: number;
  timeline_min: number;
}) => {
  const t = new Date(props.time * 1000);
  const hours = t.getHours();
  const minutes = t.getMinutes();
  const seconds = t.getSeconds();
  return <div
    style={{
      position: 'absolute',
      height: 12,
      lineHeight: '12px',
      borderLeft: '1px solid #666',
      paddingLeft: 2,
      bottom: 0,
      color: '#666',
      fontSize: '10',
      left: `${(
        ((props.time - props.timeline_min) * 100) /
        (props.timeline_max - props.timeline_min)
      ).toFixed(2)}%`,
    }}
  >{`${ensure_two_chars(hours)}:${ensure_two_chars(minutes)}:${ensure_two_chars(seconds)}`}</div>
  };

const BlockComponent = (props: {
  block: ExtendedBlock,
  top: number,
  timeline_max: number,
  timeline_min: number,
}) => {
  const block = props.block;
  const left = block.actions_broadcast_window_start - props.timeline_min;
  const actions_duration = block.actions_broadcast_window_end - block.actions_broadcast_window_start;

  const common_style: React.CSSProperties = {
    height: block_height,
    top: `${(props.top * 100).toFixed(2)}%`,
    position: 'absolute',
  };
  return (
    <React.Fragment>
      {block.keypoints.map((keypoint) => (
        <div
          key={`${keypoint.type}_${keypoint.start}`}
          style={{
            ...common_style,
            background:
              keypoint.type === KeypointType.actions_broadcast
                ? 'linear-gradient(to right,#64B5F6, #2196F3)'
                : keypoint.type === KeypointType.witness_broadcast
                ? 'linear-gradient(to right,#AED581, #8BC34A)'
                : keypoint.type === KeypointType.witness_broadcast_delay
                ? 'linear-gradient(to right, #FFD54F, #FF9800)'
                : keypoint.type ===
                  KeypointType.witness_broadcast_delay_last_one
                ? 'linear-gradient(to right, #FFD54F, #8BC34A)'
                : 'transparent',
            left: `${(
              ((keypoint.start - props.timeline_min) * 100) /
              (props.timeline_max - props.timeline_min)
            ).toFixed(2)}%`,
            width: `${(
              ((keypoint.end - keypoint.start) * 100) /
              (props.timeline_max - props.timeline_min)
            ).toFixed(2)}%`,
          }}
        />
      ))}
    </React.Fragment>
  );
}
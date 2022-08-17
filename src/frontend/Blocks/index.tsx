import React, { useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { DataGrid, GridRowsProp, GridColDef, zhCN } from '@mui/x-data-grid';

import { Timeline } from './Timeline';
import { DBBlock } from '../../shared/types';
import { get_block, get_blocks } from '../utils';
import { AHEAD_OF_ROOT_BLOCK } from '../../shared/constant';


const columns: GridColDef[] = [
  { field: 'cycle_id', headerName: 'id', width: 100 },
  { field: 'block_hash', headerName: '哈希', width: 200 },
  { field: 'actions_broadcast_window_start', headerName: '行为广播窗口（开始）', width: 200 },
  { field: 'actions_broadcast_window_end', headerName: '行为广播窗口（结束）', width: 200 },
  { field: 'witness_broadcast_window_start', headerName: '签名广播窗口（开始）', width: 200 },
  { field: 'witness_broadcast_window_end', headerName: '签名广播窗口（结束）', width: 200 },
  { field: 'n_peer_before_prev', headerName: '成员数', width: 100 },
  { field: 'n_peer_prev', headerName: '成员数2', width: 100 },
];

type ExtendedBlock = DBBlock & { id: number };
export const Blocks = () => {
  const [state, set_state] = useState<{
    rows: ExtendedBlock[],
    prev_witness_broadcast_widnow_end: number,
    page: number,
    rows_per_page: number,
    row_count: number,
    loading: boolean,
  }>({
    rows: [],
    prev_witness_broadcast_widnow_end: 0,
    page: 1,
    rows_per_page: 20,
    row_count: 0,
    loading: true,
  });
  const { rows, prev_witness_broadcast_widnow_end, page, rows_per_page, row_count, loading } = state;
  useEffect(() => {
    (async function () {
      set_state({
        ...state,
        loading: true,
      });
      const { blocks: blks, total, n } = await get_blocks(page);
      const blocks = blks.filter(i => i.block_hash !== AHEAD_OF_ROOT_BLOCK);
      set_state({
        ...state,
        rows: blocks.map((i) => ({ ...i, id: i.cycle_id })),
        row_count: total,
        rows_per_page: n,
        loading: false,
        prev_witness_broadcast_widnow_end: blocks.length
          ? blocks[0].prev_block_hash !== AHEAD_OF_ROOT_BLOCK
            ? (await get_block(blocks[0].prev_block_hash))
                .witness_broadcast_window_end
            : blocks[0].actions_broadcast_window_start
          : 0,
      });
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
          <Typography variant="h5">历史区块</Typography>
          <Timeline
            blocks={rows}
            prev_witness_broadcast_window_end={
              prev_witness_broadcast_widnow_end
            }
          />
          <div style={{ height: 300 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pagination
              page={page - 1}
              localeText={zhCN.components.MuiDataGrid.defaultProps.localeText}
              rowCount={row_count}
              paginationMode="server"
              loading={loading}
              onPageChange={(new_page) =>
                set_state({
                  ...state,
                  page: new_page + 1,
                })
              }
              rowsPerPageOptions={[rows_per_page]}
              pageSize={rows_per_page}
            />
          </div>
        </Paper>
      </Grid>
    </Grid>
  );
}
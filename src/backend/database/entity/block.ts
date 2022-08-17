import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ID_LENGTH } from '../../../shared/constant';
import { DBBlock } from '../../../shared/types';
import { bigint } from '../transformer';

@Entity()
export default class Block implements DBBlock {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  block_hash: string;

  @Column('bigint', { transformer: [bigint] })
  min_witness_broadcast_window: number;
  @Column('bigint', { transformer: [bigint] })
  min_actions_broadcast_window: number;

  @Column('int')
  cycle_id: number;

  @Column('int') // 在actions执行前的n_peer
  n_peer: number;

  @Column('bigint', { transformer: [bigint] }) // 记录最后一轮的时间
  witness_broadcast_window_end: number;
  @Column('bigint', { transformer: [bigint] }) // 记录最后一轮的时间
  witness_broadcast_window_start: number;
  @Column('bigint')
  @Column('bigint', { transformer: [bigint] })
  actions_broadcast_window_end: number;
  @Column('bigint', { transformer: [bigint] })
  actions_broadcast_window_start: number;

  @Column('varchar', { length: ID_LENGTH })
  prev_block_hash: string;

  @Column('varchar', { length: ID_LENGTH })
  witness_testimony_cid: string;

  @Column('varchar', { length: ID_LENGTH })
  witnesses_cid: string;

  @Column('varchar', { length: ID_LENGTH })
  witness_signatures_cid: string;

  @Column('varchar', { length: ID_LENGTH })
  action_bundle_cid: string;

  @Column('varchar', { length: ID_LENGTH })
  action_subjects_cid: string;

  @Column('varchar', { length: ID_LENGTH })
  action_signatures_cid: string;
}

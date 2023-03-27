import { IDBDomain, Domain, DomainID, ProposalID } from '../types';
import { ABABooleanValue, ABAStage, ABAValue, IDatabase, IDBABA, NodeID, ProposalStatus } from '../../../shared/types';
import ABAEntity from './entity/aba';
import ABAPrevoteEntity from './entity/aba-prevote';
import DomainProposalPair from './entity/domain-proposal-pair';
import { EntityManager, Not } from 'typeorm';

export default (manager: EntityManager): IDBABA => ({
  set_prevote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
    v: ABABooleanValue,
  ) => {
    await manager.upsert(
      ABAPrevoteEntity,
      { epoch, session_id, round, sender: node_id, val: v },
      ['epoch', 'session_id', 'round', 'sender', 'val'],
    );
  },
  has_prevote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
    v: ABABooleanValue,
  ) => {
    return !!(await manager.findOne(ABAPrevoteEntity, {
      epoch,
      session_id,
      round,
      sender: node_id,
      val: v,
    }));
  },
  get_prevote_count: (
    epoch: number,
    session_id: string,
    round: number,
    v: ABABooleanValue,
  ) => {
    return manager.count(ABAPrevoteEntity, {
      epoch,
      session_id,
      round,
      val: v,
    });
  },

  set_vote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
    v: ABABooleanValue,
  ) => {
    await manager.upsert(
      ABAEntity,
      {
        epoch,
        session_id,
        round,
        stage: ABAStage.vote,
        sender: node_id,
        val: v,
      },
      {
        conflictPaths: [
          'epoch',
          'session_id',
          'round',
          'stage',
          'sender',
          'val',
        ],
      },
    );
  },
  has_vote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
  ) => {
    return !!(await manager.findOne(ABAEntity, {
      epoch,
      session_id,
      round,
      sender: node_id,
      stage: ABAStage.vote,
    }));
  },
  get_vote_count: (
    epoch: number,
    session_id: string,
    round: number,
    v: ABABooleanValue,
  ) => {
    return manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.vote,
      val: v,
    });
  },
  get_vote_size: (epoch: number, session_id: string, round: number) => {
    return manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.vote,
    });
  },

  set_main_vote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
    v: ABAValue,
  ) => {
    await manager.upsert(
      ABAEntity,
      {
        epoch,
        session_id,
        round,
        stage: ABAStage.mainvote,
        sender: node_id,
        val: v,
      },
      {
        conflictPaths: [
          'epoch',
          'session_id',
          'round',
          'stage',
          'sender',
          'val',
        ],
      },
    );
  },

  has_main_vote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
  ) => {
    return !!(await manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.mainvote,
      sender: node_id,
    }));
  },
  get_main_vote_size: (epoch: number, session_id: string, round: number) => {
    return manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.mainvote,
    });
  },
  get_main_vote_count: (
    epoch: number,
    session_id: string,
    round: number,
    v: ABAValue,
  ) => {
    return manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.mainvote,
      val: v,
    });
  },

  set_final_vote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
    v: ABAValue,
  ) => {
    manager.upsert(
      ABAEntity,
      {
        epoch,
        session_id,
        round,
        stage: ABAStage.finalvote,
        sender: node_id,
        val: v,
      },
      {
        conflictPaths: [
          'epoch',
          'session_id',
          'round',
          'stage',
          'sender',
          'val',
        ],
      },
    );
  },
  has_final_vote: async (
    epoch: number,
    session_id: string,
    round: number,
    node_id: NodeID,
  ) => {
    return !!(await manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.finalvote,
      sender: node_id,
    }));
  },
  get_final_vote_size: (epoch: number, session_id: string, round: number) => {
    return manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.finalvote,
    });
  },
  get_final_vote_count: (
    epoch: number,
    session_id: string,
    round: number,
    v: ABAValue,
  ) => {
    return manager.count(ABAEntity, {
      epoch,
      session_id,
      round,
      stage: ABAStage.finalvote,
      val: v,
    });
  },
});

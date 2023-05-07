import { Domain, DomainID, ProposalID } from '../types';
import {
  ABABooleanValue,
  ABAFinalVoteMessage,
  ABAMainVoteMessage,
  ABAMessage,
  ABAPreVoteMessage,
  ABAProtocolStage,
  ABAValue,
  ABAVoteMessage,
  DBABAInfo,
  DBABALog,
  DBBlock,
  IDatabase,
  IPFSAddress,
  NodeID,
  ProposalStatus,
  Signature,
} from '../../../shared/types';
import ABALogEntity from './entity/aba-log';
import ABACacheEntity from './entity/aba-cache';
import ABAInfoEntity from './entity/aba-info';
import ABAPrevoteEntity from './entity/aba-prevote';
import DomainProposalPair from './entity/domain-proposal-pair';
import { EntityManager, Not, QueryRunner } from 'typeorm';
import { EncodeIntoResult } from 'util';

export async function add_cache(
  manager: EntityManager,
  cache: DBABALog,
) {
  await manager.insert(
    ABACacheEntity,
    cache,
  );
}

export const get_cache = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  stage: ABAProtocolStage,
) => {
  return await manager.find(ABACacheEntity, {
    where: { root_block_cid, epoch, session_id, round, stage },
  });
};
export const remove_cache = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  stage: ABAProtocolStage,
) => {
  await manager.delete(ABACacheEntity, {
    where: { root_block_cid, epoch, session_id, round, stage },
  });
};

export const set_current_info = async (
  manager: EntityManager,
  info: DBABAInfo,
) => {
  await manager.insert(ABAInfoEntity, info);
};
export const get_current_info = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
) => {
  const result = await manager.findOne(ABAInfoEntity, {
    where: { root_block_cid, epoch, session_id },
  });
  return result;
};

export const set_prevote = async (
  manager: EntityManager,
  msg: ABAPreVoteMessage,
  signature: Signature<ABAPreVoteMessage>,
) => {
  await manager.insert(ABAPrevoteEntity, { ...msg, signature });
};
export const has_prevote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
  v: ABABooleanValue,
) => {
  return !!(await manager.findOne(ABAPrevoteEntity, {
    where: {
      root_block_cid,
      epoch,
      session_id,
      round,
      sender: node_id,
      val: v,
    },
  }));
};
export const get_prevote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  const data = await manager.find(ABAPrevoteEntity, {
    where: {
      epoch,
      root_block_cid,
      session_id,
      round,
      sender: node_id,
    },
  });
  return data.map((i) => i.val as ABABooleanValue);
};

export const get_prevote_count = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  v: ABABooleanValue,
) => {
  return manager.count(ABAPrevoteEntity, {
    where: {
      root_block_cid,
      epoch,
      session_id,
      round,
      val: v,
    },
  });
};
export const set_vote = async (
  manager: EntityManager,
  msg: ABAVoteMessage,
  signature: Signature<ABAVoteMessage>,
) => {
  await manager.insert(ABALogEntity, {
    ...msg,
    signature,
  });
};
export const has_vote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  return !!(await manager.findOne(ABALogEntity, {
    where: {
      root_block_cid,
      epoch,
      session_id,
      round,
      sender: node_id,
      stage: ABAProtocolStage.ABA_VOTE,
    },
  }));
};
export const get_vote_count = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  v: ABABooleanValue,
) => {
  return manager.count(ABALogEntity, {
    where: {
      root_block_cid,
      epoch,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_VOTE,
      val: v,
    },
  });
};
export const get_vote_size = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
) => {
  return manager.count(ABALogEntity, {
    where: {
      epoch,
      root_block_cid,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_VOTE,
    },
  });
};
export const get_vote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  return (
    await manager.findOne(ABALogEntity, {
      where: {
        root_block_cid,
        epoch,
        session_id,
        round,
        sender: node_id,
        stage: ABAProtocolStage.ABA_VOTE,
      },
    })
  ).val as ABABooleanValue;
};

export const get_final_vote_msgs = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
) => {
  const logs = await manager.find(ABALogEntity, {
    where: {
      root_block_cid,
      epoch,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_FINALVOTE,
    },
    order: {
      sender: 'ASC',
    }
  });
  const msgs: ABAFinalVoteMessage[] = logs.map((i) => ({
    root_block_cid: root_block_cid,
    session_id: i.session_id,
    epoch: i.epoch,
    round: i.round,
    sender: i.sender,
    stage: ABAProtocolStage.ABA_FINALVOTE,
    val: i.val,
  }));
  
  return {msgs, signatures: logs.map((i) => i.signature)};
}
export const get_final_vote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  return (
    await manager.findOne(ABALogEntity, {
      where: {
        root_block_cid,
        epoch,
        session_id,
        round,
        sender: node_id,
        stage: ABAProtocolStage.ABA_FINALVOTE,
      },
    })
  ).val as ABAValue;
};
export const get_main_vote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  return (
    await manager.findOne(ABALogEntity, {
      where: {
        epoch,
        session_id,
        root_block_cid,
        round,
        sender: node_id,
        stage: ABAProtocolStage.ABA_MAINVOTE,
      },
    })
  ).val as ABAValue;
};
export const set_main_vote = async (
  manager: EntityManager,
  msg: ABAMainVoteMessage,
  signature: Signature<ABAMainVoteMessage>,
) => {
  await manager.insert(
    ABALogEntity,
    {
      ...msg,
      signature,
    },
  );
};

export const has_main_vote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  return !!(await manager.count(ABALogEntity, {
    where: {
      epoch,
      root_block_cid,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_MAINVOTE,
      sender: node_id,
    },
  }));
};
export const get_main_vote_size = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
) => {
  return manager.count(ABALogEntity, {
    where: {
      root_block_cid,
      epoch,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_MAINVOTE,
    },
  });
};
export const get_main_vote_count = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  v: ABAValue,
) => {
  return manager.count(ABALogEntity, {
    where: {
      epoch,
      root_block_cid,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_MAINVOTE,
      val: v,
    },
  });
};

export const set_final_vote = async (
  manager: EntityManager,
  msg: ABAFinalVoteMessage,
  signature: Signature<ABAFinalVoteMessage>,
) => {
  manager.insert(
    ABALogEntity,
    {
      ...msg,
      signature,
    },
  );
};
export const has_final_vote = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  node_id: NodeID,
) => {
  return !!(await manager.count(ABALogEntity, {
    where: {
      epoch,
      session_id,
      round,
      root_block_cid,
      stage: ABAProtocolStage.ABA_FINALVOTE,
      sender: node_id,
    },
  }));
};
export const get_final_vote_size = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
) => {
  return manager.count(ABALogEntity, {
    where: {
      epoch,
      session_id,
      root_block_cid,
      round,
      stage: ABAProtocolStage.ABA_FINALVOTE,
    },
  });
};
export const get_final_vote_count = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  session_id: string,
  round: number,
  v: ABAValue,
) => {
  return manager.count(ABALogEntity, {
    where: {
      epoch,
      root_block_cid,
      session_id,
      round,
      stage: ABAProtocolStage.ABA_FINALVOTE,
      val: v,
    },
  });
};

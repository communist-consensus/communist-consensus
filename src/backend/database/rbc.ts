import { Domain, DomainID, ProposalID, RBCEchoMessage, RBCReadyMessage, RBCValMessage } from '../types';
import {
  ABABooleanValue,
  ABAValue,
  IDatabase,
  NodeID,
  ProposalStatus,
  IPFSAddress,
  RBCStage,
  DBRBCResolved,
  DBBlock,
  Actions,
  RBCProtocolStage,
  DBRBCEcho,
  Signature,
  DBRBCVal,
  DBRBCReady,
} from '../../../shared/types';
import ABAEntity from './entity/aba-log';
import ABAPrevoteEntity from './entity/aba-prevote';
import DomainProposalPair from './entity/domain-proposal-pair';
import { EntityManager, Not, QueryRunner } from 'typeorm';
import RBCVal from './entity/rbc-val';
import RBCReady from './entity/rbc-ready';
import RBCEcho from './entity/rbc-echo';
import RBCResolved from './entity/rbc-resolved';
import { decode, encode } from '../utils';

export async function set_val(
  manager: EntityManager,
  msg: RBCValMessage,
  signature: Signature<RBCValMessage>,
) {
  const data: DBRBCVal = {
    epoch: msg.epoch,
    piece_receiver: msg.piece_receiver,
    piece_provider: msg.piece_provider,root_block_cid:msg.root_block_cid,
    roothash: msg.roothash,
    branch: await encode(msg.branch),
    piece: msg.piece,
    signature,
  };
  await manager.insert(
    RBCVal,
    data,
  );
}

export const has_val = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  node_id: NodeID,
) => {
  return !!(await manager.count(RBCVal, {
    where: { epoch, piece_provider: node_id, root_block_cid },
  }));
};

export const get_val = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  node_id: NodeID,
) => {
  const data = (
    await manager.findOne(RBCVal, {
      where: { root_block_cid, epoch, piece_provider: node_id },
    })
  )?.piece;
  if (data) {
    return await decode(data);
  }
  return undefined;
};

export const set_echo = async (
  manager: EntityManager,
  msg: RBCEchoMessage,
  signature: Signature<RBCEchoMessage>,
) => {
  const data: DBRBCEcho = {
    epoch: msg.epoch,
    sender: msg.sender,
    piece_receiver: msg.piece_receiver,
    piece_provider: msg.piece_provider,root_block_cid:msg.root_block_cid,
    roothash: msg.roothash,
    branch: await encode(msg.branch),
    piece: msg.piece,
    signature,
  };
  await manager.insert(
    RBCEcho,
    data,
  );
};

export const get_echo_size = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  piece_provider: NodeID,
  roothash: string,
) => {
  return await manager.count(RBCEcho, {
    where: { root_block_cid, epoch, roothash, piece_provider },
  });
};

export const has_echo = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  piece_receiver: NodeID,
  piece_provider: NodeID,
) => {
  return !!(await manager.count(RBCEcho, {
    where: {
      root_block_cid,
      epoch,
      piece_receiver: piece_receiver,
      piece_provider,
    },
  }));
};

export const get_echoes = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  source_provider: NodeID,
  roothash: string,
) => {
  return (
    await manager.find(RBCEcho, {
      where: {
        epoch,
        root_block_cid,
        piece_provider: source_provider,
        roothash,
      },
    })
  ).map((i) => i.piece);
};

export const set_ready = async (
  manager: EntityManager,
  msg: RBCReadyMessage,
  signature: Signature<RBCReadyMessage>,
) => {
  const data: DBRBCReady = {
    root_block_cid: msg.root_block_cid,
    epoch: msg.epoch,
    provider: msg.provider,
    cid: msg.cid,
    sender: msg.sender,
    signature,
  };
  await manager.insert(
    RBCReady,
    data,
  );
};
export const get_ready_size = (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  provider: NodeID,
  cid: string,
) => {
  return manager.count(RBCReady, {
    where: {
      epoch,
      root_block_cid,
      provider,
      cid,
    },
  });
};
export const has_ready = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  sender: NodeID,
  provider: NodeID,
) => {
  return !!(await manager.count(RBCReady, {
    where: {
      root_block_cid,
      epoch,
      sender: sender,
      provider: provider,
    },
  }));
};
export const get_ready = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  sender: NodeID,
  provider: NodeID,
) => {
  const data = await manager.findOne(RBCReady, {
    where: {
      root_block_cid,
      epoch,
      sender,
      provider: provider,
    },
  });

  return data;
};

export const get_ready_msgs = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  node_id: NodeID,
  cid: IPFSAddress<Actions>,
) => {
  const rbc_ready_list = await manager.find(RBCReady, {
    where: {
      epoch,
      provider: node_id,
      cid,
    },
    order: {
      provider: 'ASC',
    },
  });
  const msgs: RBCReadyMessage[] = rbc_ready_list.map((i) => ({
    root_block_cid,
    sender: i.sender,
    epoch,
    provider: i.provider,
    cid: i.cid,
    stage: RBCProtocolStage.RBC_READY,
  }));
  const signatures = rbc_ready_list.map((i) => i.signature);
  return { msgs, signatures };
};

export const get_resolved_cid = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  provider: NodeID,
) => {
  const data: DBRBCResolved = await manager.findOne(RBCResolved, {
    where: { root_block_cid, epoch, provider: provider},
  });
  return data.cid;
};
export const set_resolved = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  provider: NodeID,
  cid: IPFSAddress<Actions>,
) => {
  const data: DBRBCResolved = {
    root_block_cid,
    epoch,
    provider,
    cid,
  };
  await manager.insert(RBCResolved, data);
};

export const is_resolved = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  node_id: NodeID,
) => {
  return (
    (await manager.count(RBCResolved, {
      where: { root_block_cid, epoch, provider: node_id },
    })) > 0
  );
};

export const reset_echo = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  piece_provider: NodeID,
) => {
  const data: Partial<DBRBCEcho> = {
    root_block_cid,
    epoch,
    piece_provider,
  };
  await manager.delete(RBCEcho, data);
};
export const reset_val = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
  piece_provider: NodeID,
) => {
  const data: Partial<DBRBCVal> = {
    root_block_cid,
    epoch,
    piece_provider,
  };
  await manager.delete(RBCVal, data);
};

export const get_resolved_node_ids = async (
  manager: EntityManager,
  root_block_cid: IPFSAddress<DBBlock>,
  epoch: number,
) => {
  return (
    await manager.find(RBCResolved, { where: { root_block_cid, epoch } })
  ).map((i) => i.provider);
};

import { IDBDomain, Domain, DomainID, ProposalID } from '../types';
import {
  ABABooleanValue,
  ABAStage,
  ABAValue,
  IDatabase,
  IDBABA,
  IDBRBC,
  NodeID,
  ProposalStatus,
} from '../../../shared/types';
import ABAEntity from './entity/aba';
import ABAPrevoteEntity from './entity/aba-prevote';
import DomainProposalPair from './entity/domain-proposal-pair';
import { EntityManager, Not } from 'typeorm';
import RBCVal from './entity/rbc-val';
import RBCReady from './entity/rbc-ready';
import RBCEcho from './entity/rbc-echo';

export default (manager: EntityManager): IDBRBC => ({
  set_val: async (epoch: number, node_id: NodeID, val: Buffer) => {
    await manager.upsert(RBCVal, { epoch, sender: node_id, val }, [
      'epoch',
      'sender',
    ]);
  },
  has_val: async (epoch: number, node_id: NodeID) => {
    return !!(await manager.count(RBCVal, { epoch, sender: node_id }));
  },
  get_val: async (epoch: number, node_id: NodeID) => {
    return (await manager.findOne(RBCVal, { epoch, sender: node_id }))?.val;
  },

  set_echo: async (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
    roothash: string,
    val: Buffer,
  ) => {
    await manager.upsert(
      RBCEcho,
      { epoch, piece_owner: node_id, source_provider, roothash, val },
      ['epoch', 'piece_owner', 'source_provider'],
    );
  },
  get_echo_size: async (
    epoch: number,
    source_provider: NodeID,
    roothash: string,
  ) => {
    return await manager.count(RBCEcho, { epoch, roothash, source_provider });
  },
  has_echo: async (epoch: number, node_id: NodeID, source_provider: NodeID) => {
    return !!(await manager.count(RBCEcho, {
      epoch,
      piece_owner: node_id,
      source_provider,
    }));
  },
  get_echo: async (
    epoch: number,
    source_provider: NodeID,
    roothash: string,
  ) => {
    return (
      await manager.find(RBCEcho, {
        epoch,
        source_provider,
        roothash,
      })
    ).map((i) => i.val);
  },

  set_ready: async (
    epoch: number,
    node_id: NodeID,
    source_provider: NodeID,
    cid: string,
    signature: Buffer,
  ) => {
    await manager.upsert(
      RBCReady,
      { epoch, sender: node_id, source_provider, cid, signature },
      ['epoch', 'sender', 'source_provider'],
    );
  },
  get_ready_size: (epoch: number, source_provider: NodeID, cid: string) => {
    return manager.count(RBCReady, {
      epoch,
      source_provider,
      cid,
    });
  },
  has_ready: async (epoch: number, node_id: NodeID, provider: NodeID) => {
    return !!(await manager.count(RBCReady, {
      epoch,
      sender: node_id,
      source_provider: provider,
    }));
  },
  get_ready: async (epoch: number, node_id: NodeID, provider: NodeID) => {
    return (
      await manager.findOne(RBCReady, {
        epoch,
        sender: node_id,
        source_provider: provider,
      })
    )?.signature;
  },
});

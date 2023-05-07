import { DataSource, DataSourceOptions, EntityManager, EntitySchema, MixedList } from 'typeorm';
import ComputedVote from './entity/computed-vote';
import ConferencePeerPair from './entity/conference-peer-pair';
import ConferenceSolutionPair from './entity/conference-solution-pair';
import Conference from './entity/conference';
import Domain from './entity/domain';
import ProposalComment from './entity/proposal-comment';
import ProposalPeerPair from './entity/proposal-peer-pair';
import ProposalRoundPair from './entity/proposal-round-pair';
import Proposal from './entity/proposal';
import SolutionComment from './entity/solution-comment';
import SolutionTaskPair from './entity/solution-task-pair';
import Solution from './entity/solution';
import Task from './entity/task';
import VoteLog from './entity/vote-log';
import DomainProposalPair from './entity/domain-proposal-pair';
import KV from './entity/kv';
import Block from './entity/block';
import Peer from './entity/peer';
import ABAInfo from './entity/aba-info';
import ABACache from './entity/aba-cache';
import ABALog from './entity/aba-log';
import ABAPrevote from './entity/aba-prevote';
import RBCVal from './entity/rbc-val';
import RBCEcho from './entity/rbc-echo';
import RBCReady from './entity/rbc-ready';
import RBCResolved from './entity/rbc-resolved';

export const db_entities: MixedList<string | Function | EntitySchema<any>> = [
  KV,
  Block,
  Peer,
  RBCVal,
  RBCReady,
  RBCEcho,
  RBCResolved,
  ComputedVote,
  ConferencePeerPair,
  ConferenceSolutionPair,
  Conference,
  DomainProposalPair,
  Domain,
  ProposalComment,
  ProposalPeerPair,
  ProposalRoundPair,
  Proposal,
  SolutionComment,
  SolutionTaskPair,
  Solution,
  ABALog,
  ABACache,
  ABAInfo,
  ABAPrevote,
  Task,
  VoteLog,
];

export async function sub_transation(
  datasource_options: DataSourceOptions,
  fn: (manager: EntityManager) => any,
) {
  const datasource = new DataSource({
    ...datasource_options,
    entities: db_entities,
  });
  await datasource.initialize();
  const qr = datasource.createQueryRunner();
  try {
    fn(qr.manager);
  } finally {
    // await datasource.destroy();
  }
}
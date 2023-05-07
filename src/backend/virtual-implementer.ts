import { Context, VITask, VITaskType } from './types';
import * as peer_store from './database/peer';
import { EntityManager } from 'typeorm';

export async function execute_task(ctx: Context, manager: EntityManager, task: VITask) {
  if (task.type === VITaskType.AssignToEntity) {
    console.log('竞选结果：', task.mid);
    // ...
  } else if (task.type === VITaskType.DomainAdd) {
    // const domain_id = ctx.utils.gen_id();
    // await db.domain.add_domain(
    //   domain_id,
    //   {
    //     name: task.name,
    //     sub_domain: [],
    //   },
    //   task.parent_domain_uuid,
    // );
  } else if (task.type === VITaskType.DomainMerge) {
    // await db.merge_domain(task.target_domain_id, task.domain_id);
  } else if (task.type === VITaskType.DomainModify) {
    // TODO
  } else if (task.type === VITaskType.PeerAdd) {
    await peer_store.add_peer(manager, task.profile);
  } else if (task.type === VITaskType.RevokeProposal) {
    // await db.proposal.set_proposal_status(task.proposal_id, ProposalStatus.publicizing);
  } else if (task.type === VITaskType.PeerDelete) {
    // await db.peer.remove(task.mid);
  } else if (task.type === VITaskType.Upgrade) {
    eval(task.script);
  }
}

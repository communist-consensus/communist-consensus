import PeerId from 'peer-id';
import { Context, VITask, VITaskType } from './types';

export async function execute_task(ctx: Context, task: VITask) {
  const db = ctx.db;
  if (task.type === VITaskType.AssignToEntity) {
    console.log('竞选结果：', task.mid);
    // ...
  } else if (task.type === VITaskType.DomainAdd) {
    const domain_id = ctx.utils.gen_id();
    await db.domain.add_domain(
      domain_id,
      {
        name: task.name,
        sub_domain: [],
      },
      task.parent_domain_id,
    );
  } else if (task.type === VITaskType.DomainMerge) {
    // await db.merge_domain(task.target_domain_id, task.domain_id);
  } else if (task.type === VITaskType.DomainModify) {
    // TODO
  } else if (task.type === VITaskType.PeerAdd) {
    // TODO
    ctx.libp2p.peerStore.protoBook.add(await PeerId.createFromPubKey(task.profile.public_key), [
      '/ipfs/kad/1.0.0',
      '/ipfs/lan/kad/1.0.0',
    ]);
    await db.peer.add_peer(task.profile);
  } else if (task.type === VITaskType.RevokeProposal) {
    // await db.proposal.set_proposal_status(task.proposal_id, ProposalStatus.publicizing);
  } else if (task.type === VITaskType.PeerDelete) {
    await db.peer.remove(task.mid);
  } else if (task.type === VITaskType.SelfUpgrade) {
    eval(task.script);
  }
}

import { createContext, startWaterbear } from '../src/backend/bft/waterbear';
import { peerIdFromPeerId, peerIdFromKeys, peerIdFromString } from '@libp2p/peer-id'

import config_a from './config/a.local';
import config_b from './config/b.local';
import config_c from './config/c.local';
import config_d from './config/d.local';
import { forceGetConnection } from '../src/backend/dht-helper/utils';
import { b64_to_uint8array, b64pad_to_uint8array, decode, encode, get_block, get_cid, pubkey_to_node_id, sign, sleep, uint8array_to_b58, verify_cid } from '../shared/utils';
import { Action, ActionInitialAction, ActionType, DBBlock, IPFSAddress, VITaskType } from '../shared/types';
import { Multiaddr } from 'multiaddr';

async function start() {
  const action: ActionInitialAction = {
    type: ActionType.InitialAction,
    tasks: [
      {
        type: VITaskType.DomainAdd,
        supported_types: [
          VITaskType.Upgrade,
          VITaskType.DomainAdd,
          VITaskType.DomainMerge,
          VITaskType.DomainModify,
          VITaskType.PeerAdd,
          VITaskType.PeerDelete,
          VITaskType.RevokeProposal,
          VITaskType.AssignToEntity,
        ],
        name: 'core',
      },
      {
        type: VITaskType.PeerAdd,
        profile: config_b,
      },
    ],
  };
  const node_a = await createContext(config_a, {
    start_timestamp: (new Date('2023-01-01')).getTime(),
    interval: 5 * 1000 * 60,
    mode: 'init-initiator',
    initial_actions: [action],
  });

  startWaterbear(node_a, async () => {
    return [];
  });

  const block_cid = await new Promise<IPFSAddress<DBBlock>>((resolve) =>
    node_a.ee.once('new_block', (cid) => resolve(cid)),
  );

  const node_b = await createContext(config_b, {
    mode: 'init-participant',
    root_block_cid: block_cid,
    target_block_cid: block_cid,
  });

  /*
  const connection = await forceGetConnection(
    node_a,
    await peerIdFromKeys(b64pad_to_uint8array(config_b.public_key)),
  );
  await node_a.libp2p_node.dial(node_b.libp2p_node.peerId);
  */

  // const addrs = await node_c.libp2p_node!.peerStore.addressBook.get(
  //   node_d.libp2p_node.peerId,
  // );
  // console.log(connection, addrs);
  await sleep(1000 * 1000)
}

start()
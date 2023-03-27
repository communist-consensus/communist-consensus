import { addBootstrapNode, createContext, startWaterbear } from '../src/backend/bft/waterbear';
import { peerIdFromPeerId, peerIdFromKeys } from '@libp2p/peer-id'

import config_a from './config/a.local';
import config_b from './config/b.local';
import config_c from './config/c.local';
import config_d from './config/d.local';
import { forceGetConnection } from '../src/backend/p2pbroadcast/utils';
import { b64pad_to_uint8array, decode, encode, get_block, get_cid, sleep, verify_cid } from '../shared/utils';

async function start() {
  const [node_a, node_b] = await Promise.all([
    createContext(config_a, true),
    createContext(config_b, true),
  ]);

  await addBootstrapNode(
    node_b,
    node_a.libp2p_node.peerId,
    node_a.libp2p_node.getMultiaddrs(),
  );
  await addBootstrapNode(
    node_a,
    node_b.libp2p_node.peerId,
    node_b.libp2p_node.getMultiaddrs(),
  );

  await node_a.libp2p_node.dial(node_b.libp2p_node.peerId);

  await sleep(1000);

  startWaterbear(node_a, async () => {
    return Buffer.from('a-123');
  });
  startWaterbear(node_b, async () => {
    return Buffer.from('b-123');
  });
  // const connection = await forceGetConnection(
  //   node_c,
  //   await peerIdFromKeys(b64pad_to_uint8array(config_d.public_key)),
  // );
  // const addrs = await node_c.libp2p_node!.peerStore.addressBook.get(
  //   node_d.libp2p_node.peerId,
  // );
  // console.log(connection, addrs);
}

start()
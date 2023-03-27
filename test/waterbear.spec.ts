import { addBootstrapNode, createContext } from '../src/backend/bft/waterbear';
import config_a from './config/a.local';
import config_b from './config/b.local';
import config_c from './config/c.local';
import config_d from './config/d.local';
import { sleep, uint8array_to_b58, uint8array_to_b64pad } from '../shared/utils';
import { createFromJSON, createRSAPeerId, createEd25519PeerId}  from "@libp2p/peer-id-factory";

describe('waterbear', function () {
  it('success', async function () {
    const [node_a, node_b] = await Promise.all([
      createContext(config_a, true),
      createContext(config_b, true),
    ]);

    await addBootstrapNode(node_b, node_a.libp2p_node.peerId, node_a.libp2p_node.getMultiaddrs())
    await addBootstrapNode(node_a, node_b.libp2p_node.peerId, node_b.libp2p_node.getMultiaddrs())

    await node_a.libp2p_node.dial(node_b.libp2p_node.peerId);

    await sleep(5 * 1000);
  });
});

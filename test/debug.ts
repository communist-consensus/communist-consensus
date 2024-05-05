import { createContext, startWaterbear } from '../src/backend/bft/waterbear';
import {
  peerIdFromPeerId,
  peerIdFromKeys,
  peerIdFromString,
} from '@libp2p/peer-id';

import config_a from './config/a.local';
import config_b from './config/b.local';
import config_c from './config/c.local';
import config_d from './config/d.local';
import { forceGetConnection } from '../src/backend/dht-helper/utils';
import {
  b64_to_uint8array,
  b64pad_to_uint8array,
  decode,
  encode,
  get_block,
  get_cid,
  pubkey_to_node_id,
  sign,
  sleep,
  uint8array_to_b58,
  verify_cid,
} from '../shared/utils';
import {
  Action,
  ActionInitialAction,
  ActionType,
  DBBlock,
  IPFSAddress,
  VITaskType,
} from '../shared/types';
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
    start_timestamp: new Date('2023-01-01').getTime(),
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
  await sleep(1000 * 1000);
}

// start()
// import bls from "@chainsafe/bls";
// import loadBls from 'bls-signatures';
import  bls from 'bls-wasm'
(async () => {
  /*
  var BLS = await loadBls();

  const n = 4;
  const participants: {sk:any, pk: any, sign?: any, pop?: any}[] = [];
  for (let i = 0; i < n; i++) {
    const seed = Uint8Array.from(
      new Array(32).fill(0).map((i) => Math.floor(Math.random() * 256)),
    );
    const sk = BLS.AugSchemeMPL.key_gen(seed);
    const pk = sk.get_g1();
    participants.push({ sk, pk });
  }

  const message = Uint8Array.from([1, 2, 3, 4, 5]);
  for (let i = 0 ; i< n;++i) {
    participants[i].sign = BLS.PopSchemeMPL.sign(participants[i].sk, message);
    participants[i].pop = BLS.PopSchemeMPL.pop_prove(participants[i].sk);
  }

  const aggSig = BLS.AugSchemeMPL.aggregate(participants.map(i => i.sign));
  const ok = BLS.PopSchemeMPL.fast_aggregate_verify(participants.map(i => i.pk), message, aggSig);

  console.log(ok);
  */

  await bls.init(bls.BLS12_381);
  const k = 4
  const n = 10
  const msg = 'this is a pen'
  const msk: any[] = []
  const mpk: any[] = []
  const idVec: any[] = []
  const secVec: any[] = []
  const pubVec: any[] = []
  const sigVec: any[] = []

  /*
    setup master secret key
  */
  for (let i = 0; i < k; i++) {
    const sk = new bls.SecretKey()
    sk.setByCSPRNG()
    msk.push(sk)

    const pk = sk.getPublicKey()
    mpk.push(pk)
  }
  const secStr = msk[0].serializeToHexStr()
  const pubStr = mpk[0].serializeToHexStr()
  const sigStr = msk[0].sign(msg).serializeToHexStr()
  console.log(mpk[0].verify(msk[0].sign(msg), msg))

  /*
    key sharing
  */
  for (let i = 0; i < n; i++) {
    const id = new bls.Id()
//    blsIdSetInt(id, i + 1)
    id.setByCSPRNG()
    idVec.push(id)
    const sk = new bls.SecretKey()
    sk.share(msk, idVec[i])
    secVec.push(sk)

    const pk = new bls.PublicKey()
    pk.share(mpk, idVec[i])
    pubVec.push(pk)

    const sig = sk.sign(msg)
    sigVec.push(sig)
  }

  /*
    recover
  */
  const idxVec = randSelect(k, n)
  console.log('idxVec=' + idxVec)
  let subIdVec: any[] = []
  let subSecVec: any[] = []
  let subPubVec: any[] = []
  let subSigVec: any[] = []
  for (let i = 0; i < idxVec.length; i++) {
    let idx = idxVec[i]
    subIdVec.push(idVec[idx])
    subSecVec.push(secVec[idx])
    subPubVec.push(pubVec[idx])
    subSigVec.push(sigVec[idx])
  }
  {
    const sec = new bls.SecretKey()
    const pub = new bls.PublicKey()
    const sig = new bls.Signature()

    sec.recover(subSecVec, subIdVec)
    pub.recover(subPubVec, subIdVec)
    sig.recover(subSigVec, subIdVec)
    console.log(sec.serializeToHexStr(), secStr)
    console.log(pub.serializeToHexStr(), pubStr)
    console.log(sig.serializeToHexStr(), sigStr)
  }
})();


function randSelect (k, n) {
  let a: any[] = []
  let prev = -1
  for (let i = 0; i < k; i++) {
    const v = randRange(prev + 1, n - (k - i) + 1)
    a.push(v)
    prev = v
  }
  return a
}

function randRange (min, max) {
  return min + Math.floor(Math.random() * (max - min))
}

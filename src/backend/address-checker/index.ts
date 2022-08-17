import { toBuffer } from 'it-buffer';
import { Multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import { RILibp2p, IAddressChecker } from '../types';
import { PROTOCOL } from '../constant';
import Libp2p from 'libp2p';
import { pipe } from 'it-pipe';
import { collect, consume } from 'streaming-iterables';
import debug from 'debug';
const log = debug('adress-checker');
const error = debug('adress-checker:err');

const protocols = {
  check: 'check-addr',
};
const protocol_version = '1.0.0';

export default class AddressChecker implements IAddressChecker {
  libp2p: RILibp2p;

  static async create(node: RILibp2p) {
    const ac = new AddressChecker();
    ac.libp2p = node;
    ac.mount();
    return ac;
  }

  async check({
    peer,
    connection,
  }: {
    peer?: PeerId,
    connection?: Libp2p.Connection,
  }) {
    const node = this.libp2p;
    if (!connection) {
      connection = await node.dial(peer);
    }
    const { stream } = await connection.newStream(
      `/${PROTOCOL}/${protocols.check}/${protocol_version}`,
    );
    log('send');
    const [message] = await pipe(
      [],
      stream,
      stream,
      toBuffer,
      collect,
    );
    log('receive', message);

    return new Multiaddr(message as string);
  };

  mount = () => {
    const node = this.libp2p;
    node.handle(
      `/${PROTOCOL}/${protocols.check}/${protocol_version}`,
      async ({ connection, stream }) => {
        const remote_addr = connection.remoteAddr.bytes;
        log('on request', connection.remoteAddr.toString());
        await pipe(
          [
            remote_addr,
          ],
          stream,
          consume,
        );
      },
    );
  };
}
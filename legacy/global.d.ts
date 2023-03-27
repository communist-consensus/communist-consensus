import { PeerId } from '@libp2p/interface-peer-id';
import { ConsensusConfig } from '../shared/types';

declare global {
  interface Window {
    ri_config: ConsensusConfig;
    peer: PeerId;
  }
}

import PeerId from 'peer-id';
import { RIConfig } from '../shared/types';

declare global {
  interface Window {
    ri_config: RIConfig;
    peer: PeerId;
  }
}
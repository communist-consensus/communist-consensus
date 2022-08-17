import { DomainEntity } from "../shared/types";

export type ExtendedDomain = DomainEntity & {
  virtual?: boolean,
  path?: string,
};

export enum WindowUnit {
  hours = 'hours',
  minutes = 'minutes',
  days = 'days',
};

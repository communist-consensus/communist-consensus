import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ID_LENGTH } from '../../../../shared/constant';
import { DBPeer, PeerStatus } from '../../../../shared/types';

@Entity()
export default class Peer implements DBPeer {
  @PrimaryColumn('varchar', { length: ID_LENGTH })
  uuid: string;

  @Column('int')
  index: number;

  @Column('varchar', { length: ID_LENGTH })
  name: string;

  @Column('varchar', { length: ID_LENGTH })
  proof_cid: string;

  @Column('blob')
  public_key: Uint8Array;

  @Column({
    type: 'int',
    default: PeerStatus.active,
  })
  status: PeerStatus;
}

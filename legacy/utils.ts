import {
  ActionBundle,
  Actions,
  ActionSubjects,
  BlockContext,
  ConferenceID,
  DBBlock,
  DBConference,
  DBConferenceSolutionPair,
  DBDomainProposalPair,
  DBPeer,
  IProposalStore,
  DBSolution,
  DomainEntity,
  DomainID,
  ExtendedSolution,
  InitialParams,
  IPFSAddress,
  Profile,
  ProposalID,
  ConsensusConfig,
  SolutionID,
} from '../shared/types';
import {
  decode,
  encode,
  encode_to_str,
  uint8array_to_b64,
  uint8array_to_utf8,
} from '../shared/utils';
import { PeerId} from '@libp2p/interface-peer-id';

const url_prefix = 'http://localhost:4000';

export async function request<T, R>(url: string, data?: T) {
  const mid = '';

  let token: string;
  let signature: string;
  if (mid) {
    token = (
      await (
        await fetch(`${url_prefix}/token`, {
          mode: 'cors',
          method: 'POST',
        })
      ).json()
    ).token;
    signature = encode_to_str(
      // await RSA_sign(window.peer.privKey, encode_to_buffer(token)),
      ''
    );
  }
  return (await (
    await fetch(url, {
      mode: 'cors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mid,
        token: token!,
        signature: signature!,
        ...(data ? data : {}),
      }),
    })
  ).json()) as R;
}

export async function connect_to_peer(addr: string) {
  return await request(`${url_prefix}/connect_to_peer`, { addr });
}

export async function post_init(initial_params: InitialParams) {
  return await request<
    {
      initial_params: string;
    },
    {
      code: number;
      port: number;
      p2p_address: string;
    }
  >(`${url_prefix}/init`, {
    initial_params: encode_to_str(initial_params),
  });
}

export async function get_initialized(): Promise<{
  ready: boolean;
  initialized: boolean;
  error: string;
}> {
  return await request(`${url_prefix}/initialized`);
}

export async function get_sub_domains(
  domain_id: DomainID,
  page: number,
): Promise<{
  domains: DomainEntity[];
  total: number;
  n: number;
}> {
  return await request(`${url_prefix}/sub_domains/${domain_id}/${page}`);
}

export async function get_domains(
  page: number,
): Promise<{
  domains: DomainEntity[];
  total: number;
  n: number;
}> {
  return await request(`${url_prefix}/domains/${page}`);
}

export async function get_blocks(
  page: number,
): Promise<{
  blocks: DBBlock[];
  total: number;
  n: number;
}> {
  return await request(`${url_prefix}/blocks/${page}`);
}

export async function get_latest_block(): Promise<DBBlock> {
  return (await request<{}, { block: DBBlock }>(`${url_prefix}/latest_block`))
    .block;
}

export async function get_block(block_hash: IPFSAddress): Promise<DBBlock> {
  return (
    await request<{}, { block: DBBlock }>(`${url_prefix}/block/${block_hash}`)
  ).block;
}

export async function get_pending_block(): Promise<{
  pending_block: BlockContext;
  time: number;
}> {
  return await request(`${url_prefix}/pending_block`);
}

export async function get_solution(id: string) {
  return decode<ExtendedSolution>(
    (await request<{}, { solution: string }>(`${url_prefix}/solution/${id}`))
      .solution,
  );
}

export async function get_peer(mid: string) {
  return decode<DBPeer>(
    (await request<{}, { peer: string }>(`${url_prefix}/peer/${mid}`)).peer,
  );
}
export async function get_peers(page: number) {
  return decode<DBPeer[]>(
    (await request<{}, { peers: string }>(`${url_prefix}/peers/${page}`)).peers,
  );
}

export async function get_proposals(domain_id: DomainID, page: number) {
  return await request<
    {},
    { proposals: DBDomainProposalPair[]; total: number; n: number }
  >(`${url_prefix}/proposals`, { domain_id, page });
}

export async function get_proposal(domain_id: DomainID) {
  return await request<{}, { proposal: IProposalStore }>(
    `${url_prefix}/proposal/${domain_id}`,
  );
}

export async function ipfs_add(x: any) {
  return (
    await request<{}, { cid: string }>(`${url_prefix}/ipfs/add`, {
      content: encode_to_str(x),
    })
  ).cid;
}

export async function get_conferences(
  proposal_id: string,
  round_id: number,
  page = 1,
) {
  return (
    await request<{}, { conferences: DBConference[] }>(
      `${url_prefix}/proposal/${proposal_id}/round/${round_id}/conferences/${page}`,
    )
  ).conferences;
}

export async function vote_solution(
  proposal_id: string,
  conference_id: string,
  solution_id: string,
) {
  return await request<{}, {}>(
    `${url_prefix}/proposal/${proposal_id}/conference/${conference_id}/solution/${solution_id}/vote`,
  );
}

export async function has_vote_solution(
  proposal_id: string,
  conference_id: string,
  solution_id: string,
) {
  return (
    await request<{}, { voted: boolean }>(
      `${url_prefix}/proposal/${proposal_id}/conference/${conference_id}/solution/${solution_id}/voted`,
    )
  ).voted;
}

export async function get_solution_votes(
  proposal_id: string,
  conference_id: string,
  solution_id: string,
) {
  return (
    await request<{}, { votes: number }>(
      `${url_prefix}/proposal/${proposal_id}/conference/${conference_id}/solution/${solution_id}/votes`,
    )
  ).votes;
}

export async function get_solutions(
  proposal_id: string,
  round_id: number,
  conference_id: string,
  page = 1,
) {
  return (
    await request<{}, { solutions: DBConferenceSolutionPair[] }>(
      `${url_prefix}/proposal/${proposal_id}/round/${round_id}/conference/${conference_id}/solutions/${page}`,
    )
  ).solutions;
}

export async function ipfs_get<T>(x: string) {
  return decode<T>(
    (await request<{}, { content: string }>(`${url_prefix}/ipfs/get/${x}`))
      .content,
  );
}

export async function resume(peer_json) {
  return await request(`${url_prefix}/resume`, { peer_json });
}

export async function commit_actions(actions: Actions) {
  return await request(`${url_prefix}/commit_actions`, { actions });
}

export const save_to_file = (
  filename,
  content,
  content_type = 'text/plain',
) => {
  const a = document.createElement('a');
  const file = new Blob([content], { type: content_type });
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
};

export async function load_text_from_file_element(e: any) {
  const content: string = await new Promise((resolve) => {
    const file = e.currentTarget.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      resolve((reader as any).result);
    };
    reader.readAsText(file);
  });
  return content;
}

export function readable_timestamp(t: number) {
  if (t > 9652022553) {
    return 'Infinity';
  }
  return new Date(t * 1000).toString();
}

export async function comment_solution(
  proposal_id: ProposalID,
  conference_id: ConferenceID,
  solution_id: SolutionID,
  content_cid: string,
) {
  return await request<{}, {}>(
    `${url_prefix}/proposal/${proposal_id}/conference/${conference_id}/solution/${solution_id}/comment`,
    { content_cid },
  );
}

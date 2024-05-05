import { hash } from '.';

/**
 * root is tree[1]
 * @param data
 * @returns
 */
export function createMerkleTree(data: any[]) {
  const n = data.length;
  const n_leaves = Math.pow(2, Math.ceil(Math.log(n)));
  const tree = new Array(n_leaves * 2).fill(0).map((i) => '');
  for (let i = 0; i < data.length; ++i) {
    tree[n_leaves + i] = hash(data[i]);
  }
  for (let i = n_leaves - 1; i > 0; --i) {
    tree[i] = hash(tree[i * 2] + tree[i * 2 + 1]);
  }
  return tree;
}

export function getMerkleBranch(index: number, tree: string[]) {
  const res: string[] = [];
  let t = index + (tree.length >> 1);
  while (t > 1) {
    // 在到root的路径上取相邻的节点
    res.push(tree[t ^ 1]);
    t = t >> 1;
  }
  return res;
}

export function merkleVerify(
  val: Uint8Array,
  roothash: string,
  branch: string[],
  index: number,
) {
  let tmp = hash(val);
  let tindex = index;
  for (const br of branch) {
    // 合并相邻节点计算摘要
    tmp = hash((tindex & 1 && br + tmp) || tmp + br);
    tindex = tindex >> 1;
  }
  if (tmp != roothash) return false;
  return true;
}

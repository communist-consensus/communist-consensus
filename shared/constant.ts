// key must be 256 bits (32 characters)
export const AES_KEY_LENGTH = 32;
export const K_BUCKET_SIZE = 20;
export const K_BUCKET_CACHE_SIZE = 256; // IPFS 默认值
export const N_CONCURRENCY = 6; // 并发数
export const PING_TIMEOUT = 500; // ping超时 ms
export const FIND_TIMEOUT = 500; // find_node/find_value 单次超时
export const KEY_EXPIRED = 24 * 60 * 60 * 1000;

export const MAX_TIMESTAMP = 99999999990000;

export const MAX_PUBLICITY_DURATION = 100; // 7 * 24 * 3600

// 如果CACHE为空且K_BUCKET未满，连续多次未响应，将它标记为STALE（暂停对它发送请求）
// 当K_BUCKET装满时，删除STALE状态的节点
// 等待 2^n s或当STALE节点发来请求时恢复
export const N_FAIL_TO_STALE = 5;

// 最小在线节点比例（以进行生成块的投票）
export const MIN_ONLINE_RATE = 0.5;

export const MAX_VI_TASK_DEPTH = 10;

export const ID_LENGTH = 128;
export const KV_LENGTH = 1000;
export const URL_MAX_LENGTH = 300;
export const TITLE_LENGTH = 100;

// 不超过16个字符
export const PROTOCOL = 'cc';

// 传播时间
export const MIN_TRANSMISSION_DURATION = 1; // 秒
// 中位数时差
export const MIN_TIME_ERROR = 1; // 秒

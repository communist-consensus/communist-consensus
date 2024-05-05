BLS签名

每个epoch，需要

支持动态节点（旧的节点不需要重新生成密钥），无限聚合，比例阈值签名或者动态k of n阈值，签名一致性（达到阈值后签名一致）
签名过程中允许部分节点离线
加分：签名长度与n无关

BGLS 聚合签名长度固定
BLS 聚合签名长度与n正相关 动态k of n
    1) 使用k个参与者的sk生成n个共享sk，并分配给对应的参与者
    2) n个参与者各自使用共享sk完成消息签名
    3) 任意k个共享签名可以组成有效的签名

    DKG Overview
  1) Each member will "setup" and generate a verification vector and secret
  key contrubution share for every other member
  2) Each member post their verifcation vector publicly
  3) Each member sends their key contrubution share each other member
  4) When a member recieves a contrubution share it validates it against
  the senders verifcation vector and saves it
  5) After members receive all thier contribution shares they compute
  their secret key for the group



Hash图门限签名
Cosi
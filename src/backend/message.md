```mermaid
graph TD;

DHThelper
libp2p
/cc/dht-helper/1.0.0
{
    subProtocol: 'RBC_VAL' | 'RBC_ECHO' | 'RBC_READY' | 'WATERBEAR_ABA',
    msg: Uint8Array
}

get(cid)
provide(obj)
addListener(subProtocol, handler)
removeListener(subProtocol, handler)
send(target, msg)
broadcast(msg)

```
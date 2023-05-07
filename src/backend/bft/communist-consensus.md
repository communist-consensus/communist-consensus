```mermaid
graph TD;
subgraph main-thread
    libp2p
    networking
    database
end
subgraph sub-thread
    rbc
end

main-thread --> sub-thread
sub-thread --> main-thread
```
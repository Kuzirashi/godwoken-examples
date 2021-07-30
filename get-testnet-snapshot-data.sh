#!/usr/bin/env bash

target="./indexer-data-path/0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606"

if [ ! -f ./20210718-nervos-ckb-indexer-0.2.0-testnet-snapshot.7z ]; then
	curl -O https://s3.amazonaws.com/cdn.ckb.tools/snapshots/20210718-nervos-ckb-indexer-0.2.0-testnet-snapshot.7z -L
fi

if [ -d $target ]; then
	rm -r $target
fi

7z x 20210718-nervos-ckb-indexer-0.2.0-testnet-snapshot.7z -oindexer-data-path/0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606 -aoa

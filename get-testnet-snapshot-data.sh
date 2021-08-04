#!/usr/bin/env bash

indexerPath="./indexer-data-path/0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606"
snapshot=20210801-nervos-lumos-indexer-0.16.0-testnet-snapshot.7z

if [ ! -f ./$snapshot ]; then
	curl -O https://s3.amazonaws.com/cdn.ckb.tools/snapshots/$snapshot -L
fi

if [ -d $indexerPath ]; then
	rm -r $indexerPath
fi

7z x $snapshot -o$indexerPath -aoa

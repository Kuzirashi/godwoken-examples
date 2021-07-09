#!/usr/bin/env bash

if [ ! -f ./20210704-nervos-ckb-indexer-testnet-snapshot.7z ]; then
	curl -O https://s3.amazonaws.com/cdn.ckb.tools/snapshots/20210704-nervos-ckb-indexer-testnet-snapshot.7z -L
fi

if [ -f ./indexer-data ]; then
	rm -r ./indexer-data
fi

7z x 20210704-nervos-ckb-indexer-testnet-snapshot.7z -oindexer-data -aoa

#!/usr/bin/env bash

snapshot=20210730-nervos-lumos-indexer-0.16.0-testnet-snapshot.7z

if [ ! -f ./$snapshot ]; then
	curl -O https://s3.amazonaws.com/cdn.ckb.tools/snapshots/$snapshot -L
fi

if [ -f ./indexer-data ]; then
	rm -r ./indexer-data
fi

7z x $snapshot -oindexer-data -aoa

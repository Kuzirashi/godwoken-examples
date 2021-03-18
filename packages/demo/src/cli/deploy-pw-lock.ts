#!/usr/bin/env node
import { Command } from "commander";
import { HexString, Cell, Script, Hash } from "@ckb-lumos/base";
import { Indexer } from "@ckb-lumos/indexer";
import {
  TransactionSkeleton,
  sealTransaction,
  generateAddress,
} from "@ckb-lumos/helpers";
import { common } from "@ckb-lumos/common-scripts";
import { key } from "@ckb-lumos/hd";
import { RPC } from "ckb-js-toolkit";
import path from "path";
import { getConfig, initializeConfig } from "@ckb-lumos/config-manager";
import pwLock from '../configs/pw-lock.bin.json';
import { HashType } from "@lay2/pw-core";

const program = new Command();
program.version("0.0.1");

program
  .requiredOption("-p, --private-key <privateKey>", "private key to use")
  .option("-r, --rpc <rpc>", "rpc path", "http://127.0.0.1:8114")
  .option("-d, --indexer-path <path>", "indexer path", "./indexer-data")
  .option(
    "-l, --eth-address <args>",
    "Eth address (layer2 lock args, using --private-key value to calculate if not provided)"
  );

program.parse(process.argv);

function privateKeyToCkbAddress(privateKey: HexString): string {
  const publicKey = key.privateToPublic(privateKey);
  const publicKeyHash = key.publicKeyToBlake160(publicKey);
  const scriptConfig = getConfig().SCRIPTS.SECP256K1_BLAKE160!;
  const script = {
    code_hash: scriptConfig.CODE_HASH,
    hash_type: scriptConfig.HASH_TYPE,
    args: publicKeyHash,
  };
  const address = generateAddress(script);
  return address;
}

async function sendTx(
  fromAddress: string,
  indexer: Indexer,
  privateKey: HexString,
  ckbUrl: string
): Promise<Hash> {
  let txSkeleton = TransactionSkeleton({ cellProvider: indexer });

  const amount = BigInt(7999999800000);
  // const ownerLock: Script = parseAddress(fromAddress);
  // const ownerLockHash: Hash = utils.computeScriptHash(ownerLock);

  const lock: Script = {
    code_hash: pwLock.lock.code_hash,
    hash_type: HashType.type,
    args: pwLock.lock.args,
  };

  const outputCell: Cell = {
    cell_output: {
      capacity: "0x" + BigInt(amount).toString(16),
      lock,
    },
    data: pwLock.data,
  };

  txSkeleton = txSkeleton.update("outputs", (outputs) => {
    return outputs.push(outputCell);
  });

  txSkeleton = await common.injectCapacity(
    txSkeleton,
    [fromAddress],
    BigInt(amount)
  );

  txSkeleton = await common.payFeeByFeeRate(
    txSkeleton,
    [fromAddress],
    BigInt(1000)
  );

  txSkeleton = common.prepareSigningEntries(txSkeleton);

  const message: HexString = txSkeleton.get("signingEntries").get(0)!.message;
  const content: HexString = key.signRecoverable(message, privateKey);

  const tx = sealTransaction(txSkeleton, [content]);

  const rpc = new RPC(ckbUrl);
  const txHash: Hash = await rpc.send_transaction(tx);

  return txHash;
}

const run = async () => {
  if (process.env.LUMOS_CONFIG_FILE) {
    process.env.LUMOS_CONFIG_FILE = path.resolve(process.env.LUMOS_CONFIG_FILE);
  }

  console.log("LUMOS_CONFIG_FILE:", process.env.LUMOS_CONFIG_FILE);

  initializeConfig();

  const indexerPath = path.resolve(program.indexerPath);

  const indexer = new Indexer(program.rpc, indexerPath);
  indexer.startForever();

  console.log("waiting for sync ...");
  await indexer.waitForSync();
  console.log("synced ...");

  const privateKey = program.privateKey;
  const ckbAddress = privateKeyToCkbAddress(privateKey);
  try {
    const txHash: Hash = await sendTx(
      ckbAddress,
      indexer,
      privateKey,
      program.rpc
    );

    console.log("txHash:", txHash);
    console.log(`-------------------`);
    const pwLockConfig = `pwLock: {
      cellDep: new CellDep(
        DepType.code,
        new OutPoint(
          '${txHash}',
          '0x0'
        )
      ),
      script: new Script(
        '0xeffe377419256d150d68368d7cb5731edad39d1805a8c2c73ce8e9615b9f9878',
        '0x',
        HashType.data
      ),
    }`;
    console.log(`Update packages/demo/src/configs/pw-dev-config.ts with value: `);
    console.log(pwLockConfig);
    

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

run();

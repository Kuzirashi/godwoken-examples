#!/usr/bin/env node
import { Command } from "commander";
import { HexString } from "@ckb-lumos/base";
import { Indexer } from "@ckb-lumos/indexer";
import {
  generateAddress,
} from "@ckb-lumos/helpers";
import { key } from "@ckb-lumos/hd";
import path from "path";
import { getConfig, initializeConfig } from "@ckb-lumos/config-manager";
import { Address, AddressType, Amount, AmountUnit, Builder } from "@lay2/pw-core";
import { initPWCore } from '../js/pw';

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

const run = async () => {
  if (process.env.LUMOS_CONFIG_FILE) {
    process.env.LUMOS_CONFIG_FILE = path.resolve(process.env.LUMOS_CONFIG_FILE);
  }

  console.log("LUMOS_CONFIG_FILE:", process.env.LUMOS_CONFIG_FILE);

  initializeConfig();

  const privateKey = program.privateKey;

  const pwCore = await initPWCore(privateKey);

  const indexerPath = path.resolve(program.indexerPath);

  const indexer = new Indexer(program.rpc, indexerPath);
  indexer.startForever();

  console.log("waiting for sync ...");
  await indexer.waitForSync();
  console.log("synced ...");

  const ckbAddress = privateKeyToCkbAddress(privateKey);
  const ethAddress = new Address(program.ethAddress, AddressType.eth);
  console.log(`sending from CKB address: ${ckbAddress} to eth address: ${ethAddress.addressString}`);

  // for ckb system lock script, its length of witness lock is 65 bytes, use RawScep256K1 here.
  const options = { witnessArgs: Builder.WITNESS_ARGS.RawSecp256k1 };

  try {
    const txHash = await pwCore.send(ethAddress, new Amount('1200', AmountUnit.ckb), options);

    console.log("txHash:", txHash);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

run();

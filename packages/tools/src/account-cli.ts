import { Command } from "commander";

import { run as depositRun } from "./account/deposit-ckb";
import { run as depositSudtRun } from "./account/deposit-sudt";
import { getBalance } from "./account/get-balance";
import { run as transferRun } from "./account/transfer";
import { run as withdrawRun } from "./account/withdraw";

const program = new Command();
program.version("0.0.1");

let defaultGodwokenRpc = "http://127.0.0.1:8119";
let defaultPrefixWithGw = false;
if (!process.env.LUMOS_CONFIG_FILE) {
  defaultGodwokenRpc = "http://godwoken-testnet-web3-rpc.ckbapp.dev";
  defaultPrefixWithGw = true;
}

program
  .option(
    "-g, --godwoken-rpc <rpc>",
    "godwoken rpc path, defualt to http://127.0.0.1:8119, and LUMOS_CONFIG_FILE not provided, default to http://godwoken-testnet-web3-rpc.ckbapp.dev",
    defaultGodwokenRpc
  )
  .option(
    "-w, --prefix-with-gw",
    "prefix with `gw_` or not, , defualt to false, and LUMOS_CONFIG_FILE not provided, default to true",
    defaultPrefixWithGw
  );

program
  .command("deposit")
  .description("deposit CKB to godwoken")
  .requiredOption("-p, --private-key <privateKey>", "private key to use")
  .requiredOption("-c --capacity <capacity>", "capacity in shannons")
  .option("-r, --rpc <rpc>", "ckb rpc path", "http://127.0.0.1:8114")
  .option("-d, --indexer-path <path>", "indexer path", "./indexer-data")
  .option(
    "-l, --eth-address <args>",
    "Eth address (layer2 lock args, using --private-key value to calculate if not provided)"
  )
  .action(depositRun);

program
  .command("deposit-sudt")
  .description("deposit sUDT to godwoken")
  .requiredOption("-p, --private-key <privateKey>", "private key to use")
  .requiredOption("-m --amount <amount>", "sudt amount")
  .requiredOption("-s --sudt-script-args <l1 sudt script args>", "sudt amount")
  .option("-r, --rpc <rpc>", "ckb rpc path", "http://127.0.0.1:8114")
  .option("-d, --indexer-path <path>", "indexer path", "./indexer-data")
  .option(
    "-l, --eth-address <args>",
    "Eth address (layer2 lock args, using --private-key value to calculate if not provided)"
  )
  .option("-c, --capacity <capacity>", "capacity in shannons", "40000000000")
  .option("-b, --bip44", 'whether to use BIP44 wallet address', false)
  .option("-bp, --bip-path <bipPath>", 'BIP44 address path to use', `m/44'/309'/0'/0/0`)
  .option("-cc, --chain-code <chainCode>", 'BIP44 chain code to use with the private key')
  .action(depositSudtRun);

program
  .command("transfer")
  .description("transfer godwoken sudt to another account")
  .requiredOption("-p, --private-key <privateKey>", "private key to use")
  .requiredOption(
    "-m, --amount <amount>",
    "capacity in shannons OR amount in sudt"
  )
  .requiredOption("-e, --fee <fee>", "fee")
  .requiredOption("-t, --to-id <to id>", "to id")
  .requiredOption("-s, --sudt-id <sudt id>", "sudt id")
  .option("-r, --rpc <rpc>", "ckb rpc path", "http://127.0.0.1:8114")
  .option("-d, --indexer-path <path>", "indexer path", "./indexer-data")
  .action(transferRun);

program
  .command("withdraw")
  .description("withdraw CKB / sUDT from godwoken")
  .requiredOption("-p, --private-key <privateKey>", "private key to use")
  .requiredOption("-c, --capacity <capacity>", "capacity in shannons")
  .requiredOption(
    "-o --owner-ckb-address <owner ckb address>",
    "owner ckb address (to)"
  )
  .option(
    "-s --sudt-script-hash <sudt script hash>",
    "l1 sudt script hash, default for withdrawal CKB",
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  )
  .option("-m --amount <amount>", "amount of sudt", "0")
  .option("-r, --rpc <rpc>", "ckb rpc path", "http://127.0.0.1:8114")
  .option("-d, --indexer-path <path>", "indexer path", "./indexer-data")
  .action(withdrawRun);

program
  .command("get-balance")
  .description(
    "get CKB / sUDT balance from godwoken, default sudt-id is 1 (for CKB)"
  )
  .requiredOption("-a, --account-id <account id>", "account id")
  .option("-s, --sudt-id <sudt id>", "sudt id", "1")
  .action(getBalance);

program.parse(process.argv);

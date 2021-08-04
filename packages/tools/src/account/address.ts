import { HexString, Script, utils } from "@ckb-lumos/base";
import { Godwoker } from "@polyjuice-provider/base";
import commander from "commander";
import { deploymentConfig } from "../modules/deployment-config";
import { getRollupTypeHash } from "../modules/deposit";
import { ROLLUP_TYPE_HASH } from "../modules/godwoken-config";

function ethEoaAddressToGodwokenShortAddress(ethAddress: HexString): HexString {
  if (ethAddress.length !== 42 || !ethAddress.startsWith("0x")) {
    throw new Error("eth address format error!");
  }

  const layer2Lock: Script = {
    code_hash: deploymentConfig.eth_account_lock.code_hash,
    hash_type: deploymentConfig.eth_account_lock.hash_type as "data" | "type",
    args: ROLLUP_TYPE_HASH + ethAddress.slice(2).toLowerCase(),
  };
  const scriptHash = utils.computeScriptHash(layer2Lock);
  const shortAddress = scriptHash.slice(0, 42);
  return shortAddress;
}

export const toShortAddress = async (program: commander.Command) => {
  const ethAddress = program.ethAddress;

  try {
    const shortAddress = ethEoaAddressToGodwokenShortAddress(ethAddress);
    console.log("godwoken short address:", shortAddress);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export const toEthAddress = async (program: commander.Command) => {
  const shortAddress = program.shortAddress;
  const godwokenURL = program.parent.godwokenRpc;

  const godwoker = new Godwoker(godwokenURL, {
    godwoken: {
      eth_account_lock: {
        code_hash: deploymentConfig.eth_account_lock.code_hash,
        hash_type: deploymentConfig.eth_account_lock.hash_type as "data" | "type"
      },
      rollup_type_hash: getRollupTypeHash()
    }
  });

  try {
    const ethAddress = await godwoker.getEthAddressByAllTypeShortAddress(shortAddress);
    console.log("eth eoa address:", ethAddress);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

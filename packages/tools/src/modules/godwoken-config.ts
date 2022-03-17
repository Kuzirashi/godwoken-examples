import { Hash, Script } from "@ckb-lumos/base";

const godwokenConfig = require("../../configs/godwoken-config.json");

export const ROLLUP_TYPE_HASH: Hash = godwokenConfig.genesis.rollup_type_hash;
export const ROLLUP_TYPE_SCRIPT: Script =
  godwokenConfig.chain.rollup_type_script;
import { getCurrentEthAccount } from "./utils/eth_account";
import { displayBalance } from "./pages/balance";
import { displayEthAddress } from "./pages/display_eth_address";
import { depositCKB, depositSudt, initDepositSudtPage } from "./pages/deposit";
import {
  deploySimpleStorage,
  simpleStorageGet,
  simpleStorageSet,
} from "./pages/polyjuice";
import { godwokenQuerySudt } from "./pages/query_sudt";
import { godwokenSudtTransfer } from "./pages/sudt_transfer";
import { godwokenWithdraw } from "./pages/withdraw";
import { Hash } from "@ckb-lumos/base";
import { getAccountIdByEthAddress, getLayer2LockHash } from "./polyjuice";
import { initPWCore } from "./pw";

async function withPw(currentEthAddress: string) {
  const pwcore = await initPWCore();

  depositCKB(pwcore, currentEthAddress);
  depositSudt(pwcore, currentEthAddress);
}

async function info(currentEthAddress: string) {
  console.log("current eth address:", currentEthAddress);
  const layer2LockHash: Hash = getLayer2LockHash(currentEthAddress);
  console.log("layer2 lock hash:", layer2LockHash);
  const accountId = await getAccountIdByEthAddress(currentEthAddress);
  console.log("account id:", accountId);
}

async function main() {
  const currentEthAddress: string = await getCurrentEthAccount();

  info(currentEthAddress);

  displayEthAddress(currentEthAddress);

  withPw(currentEthAddress);

  initDepositSudtPage();

  displayBalance(currentEthAddress);

  // SimpleStorage
  deploySimpleStorage(currentEthAddress);
  simpleStorageGet(currentEthAddress);
  simpleStorageSet(currentEthAddress);

  godwokenQuerySudt(currentEthAddress);
  godwokenSudtTransfer(currentEthAddress);
  godwokenWithdraw(currentEthAddress);
}

main();

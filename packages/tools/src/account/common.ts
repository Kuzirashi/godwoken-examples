import { initializeConfig } from "@ckb-lumos/config-manager";
import path from "path";
import { CkbIndexer } from './indexer-remote';
import { env } from "process";
import { RPC } from "ckb-js-toolkit";
import { Godwoken } from "@godwoken-examples/godwoken";

import { asyncSleep } from "../modules/utils";
import { Hash } from "@ckb-lumos/base";

async function indexerReady(indexer: any, updateProgress=((_indexerTip: bigint, _rpcTip: bigint)=>{}), options: any)
{
	const defaults = {blockDifference: 0, timeoutMs: 300_000, recheckMs: 500};
	options = {...defaults, ...options};

	return new Promise(async (resolve, reject) =>
	{
		let timedOut = false;
		const timeoutTimer = (options.timeoutMs !== 0) ? setTimeout(()=>{timedOut = true;}, options.timeoutMs) : false;
		const rpc = new RPC(indexer.uri);

		let indexerFailureCount = 0;
		let rpcFailureCount = 0;

		while(true)
		{
			if(timedOut)
				return reject(Error("Transaction timeout."));

      let indexerTipObj: any = null;

      try {
			  indexerTipObj = await indexer.tip();
      } catch (error) {
        console.error(error?.message);

        throw new Error(`Can't connect to ckb-indexer. Please make sure ckb-indexer is running and its URL is valid and reachable. Make sure the URL begins with http:// or https://.`);
      }

      if(!indexerTipObj)
			{
				if(++indexerFailureCount >= 5)
					return reject(Error("Indexer gave an unexpected response."));

				await new Promise((resolve)=>setTimeout(resolve, 1000));
				continue;
			}
			
			const rpcResponse = await rpc.get_tip_block_number();
			if(!rpcResponse)
			{
				if(++rpcFailureCount >= 5)
					return reject(Error("RPC gave an unexpected response."));

				await new Promise((resolve)=>setTimeout(resolve, 1000));
				continue;
			}
	
			const indexerTip = BigInt(indexerTipObj.block_number);
			const rpcTip = BigInt(rpcResponse);

			if(indexerTip >= (rpcTip - BigInt(options.blockDifference)))
			{
				if(timeoutTimer)
					clearTimeout(timeoutTimer);

				break;
			}

			updateProgress(indexerTip, rpcTip);

			await new Promise(resolve=>setTimeout(resolve, options.recheckMs));
		}

		return resolve(null);
	});
}

export function initConfig() {
  if (!env.LUMOS_CONFIG_NAME && !env.LUMOS_CONFIG_FILE) {
    env.LUMOS_CONFIG_NAME = "AGGRON4";
    console.log("LUMOS_CONFIG_NAME:", env.LUMOS_CONFIG_NAME);
  }
  if (env.LUMOS_CONFIG_FILE) {
    env.LUMOS_CONFIG_FILE = path.resolve(env.LUMOS_CONFIG_FILE);
    console.log("LUMOS_CONFIG_FILE:", env.LUMOS_CONFIG_FILE);
  }

  initializeConfig();
}

export async function initConfigAndSync(
  ckbRpc: string,
  ckbIndexerUrl: string
): Promise<CkbIndexer> {
  initConfig();

  const indexer = new CkbIndexer(ckbRpc, ckbIndexerUrl);

  console.log("Indexer is syncing. Please wait...");
  let lastMessage = '';
	await indexerReady(indexer, (indexerTip: bigint, rpcTip: bigint)=>
    {
      const newMessage = `Syncing ${Math.floor(Number(indexerTip)/Number(rpcTip)*10_000)/100}% completed.`;
      if (lastMessage !== newMessage) {
        console.log(newMessage);
        lastMessage = newMessage;
      }
    },
    {timeoutMs: 0, recheckMs: 800}
  );
  console.log("Indexer synchronized.");
  return indexer;
}

export async function waitTxCommitted(
  txHash: string,
  ckbRpc: RPC,
  timeout: number = 300,
  loopInterval = 10
) {
  for (let index = 0; index < timeout; index += loopInterval) {
    const txWithStatus = await ckbRpc.get_transaction(txHash);
    const status = txWithStatus.tx_status.status;
    console.log(`tx ${txHash} is ${status}, waited for ${index} seconds`);
    await asyncSleep(loopInterval * 1000);
    if (status === "committed") {
      console.log(`tx ${txHash} is committed!`);
      return;
    }
  }
  throw new Error(`tx ${txHash} not committed in ${timeout} seconds`);
}

export async function waitForDeposit(
  godwoken: Godwoken,
  accountScriptHash: Hash,
  originBalance: bigint,
  sudtScriptHash?: Hash, // if undefined, sudt id = 1
  timeout: number = 300,
  loopInterval = 10
) {
  let accountId = undefined;
  let sudtId: number | undefined = 1;

  if (sudtId === 1) {
    console.log(`CKB balance in Godwoken is: ${originBalance} Shannons.`);
  }

  for (let i = 0; i < timeout; i += loopInterval) {
    console.log(
      `Waiting for Layer 2 block producer to collect the deposit cell ... ${i} seconds.`
    );

    if (!accountId) {
      accountId = await godwoken.getAccountIdByScriptHash(accountScriptHash);
      if (!accountId) {
        await asyncSleep(loopInterval * 1000);
        continue;
      }
      console.log("Your account id:", accountId);
    }

    if (sudtScriptHash !== undefined && (!sudtId || sudtId === 1)) {
      sudtId = await godwoken.getAccountIdByScriptHash(sudtScriptHash);
      if (!sudtId) {
        await asyncSleep(loopInterval * 1000);
        continue;
      }
      console.log("Your sUDT id:", sudtId);
    }

    const address = accountScriptHash.slice(0, 42);
    const godwokenCkbBalance = await godwoken.getBalance(1, address);

    if (originBalance !== godwokenCkbBalance) {
      console.log(`CKB balance in Godwoken is: ${godwokenCkbBalance} Shannons.`);

      if (sudtId !== 1) {
        const godwokenSudtBalance = await godwoken.getBalance(sudtId!, address);
        console.log(`sUDT balance in Godwoken is: ${godwokenSudtBalance}.`);
      }
      console.log(`Deposit success!`);
      return;
    }
    await asyncSleep(loopInterval * 1000);
  }

  console.log(
    `Timeout for waiting deposit success in Godwoken, please check with account id: ${accountId} by yourself.`
  );
}

export async function waitForWithdraw(
  godwoken: Godwoken,
  accountScriptHash: Hash
) {
  const accountId = await godwoken.getAccountIdByScriptHash(accountScriptHash);

  console.log("Your account id:", accountId);

  const address = accountScriptHash.slice(0, 42);
  const godwokenCkbBalance = await godwoken.getBalance(1, address);
  console.log(`ckb balance in godwoken is: ${godwokenCkbBalance}`);

  console.log(`Success! Withdrawal request sent. You need to wait now for the challenge period duration to pass to unlock the funds.`);
}

export async function waitForTransfer(
  godwoken: Godwoken,
  txHash: Hash,
  timeout: number = 300,
  loopInterval = 10
) {
  let receipt: any;
  for (let i = 0; i < timeout; i += loopInterval) {
    console.log(`waiting for layer 2 block producer transfer ... ${i} seconds`);

    if (!receipt) {
      receipt = await godwoken.getTransactionReceipt(txHash);
      if (receipt) {
        console.log("Transaction receipt:", receipt);
        return;
      }
    }

    await asyncSleep(loopInterval * 1000);
  }

  console.log(
    `timeout for waiting transfer success in godwoken, please check with tx hash: ${txHash} by your self.`
  );
}

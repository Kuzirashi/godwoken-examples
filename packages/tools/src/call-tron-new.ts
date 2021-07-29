import { HexNumber, HexString, utils } from "@ckb-lumos/base";
import { L2Transaction, RawL2Transaction, Godwoken as GodwokenOld, core, toBuffer } from "../../godwoken/lib";
import { Polyjuice } from "../../polyjuice/lib";
import { _generateTransactionMessageToSign, _generateTransactionMessageToSignNoPrefix, _generateTransactionMessageToSignTron } from "./common";
import { ethAddressToScriptHash, tronAddressToScriptHash } from "./modules/godwoken";
import { Signer, Godwoker } from '@polyjuice-provider/base';
import { Godwoken } from '@polyjuice-provider/godwoken';
import { sign } from 'eth-lib/lib/account';
import { NormalizeRawL2Transaction } from "../../godwoken/lib/normalizer";
const Web3 = require('web3');
const { PolyjuiceAccounts } = require("@polyjuice-provider/web3");
const { getAccountIdByContractAddress } = require('./modules/godwoken');
import TronWeb from 'tronweb';
const keccak256 = require("keccak256");

const ACCOUNT_PRIVATE_KEY = '5789d39fd2ce1978a857fa3cf86555ae8fc8b12a8106191b7f4a6b43808b134f'; // Replace this with your Ethereum private key with funds on Layer 2.

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { "TRON-PRO-API-KEY": '87c0092c-72e2-4208-a078-44083a1a0267' },
  privateKey: ACCOUNT_PRIVATE_KEY
});

console.log(TronWeb.Trx);

export type EthTransaction = {
  from: HexString;
  to: HexString;
  gas?: HexNumber;
  gasPrice?: HexNumber;
  value: HexNumber;
  data: HexString;
  nonce?: HexNumber;
};

export type L2TransactionArgs = {
  to_id: number;
  value: bigint;
  data: HexString;
};

/**
 * BEFORE USING THIS SCRIPT MAKE SURE TO REPLACE:
 * - <YOUR_CONTRACT_ABI>
 * - <YOUR_CONTRACT_ADDRESS>
 * - CONTRACT_ADDRESS variable value
 * - YOUR_READ_FUNCTION_NAME method name
 * - YOUR_WRITE_FUNCTION_NAME method name
 */

/**
 * LUMOS_CONFIG_FILE=/home/kuzi/projects/godwoken-kicker/godwoken/deploy/lumos-config.json node ./packages/tools/lib/account-cli.js deposit -c 4000000 -p 0x6cd5e7be2f6504aa5ae7c0c04178d8f47b7cfc63b71d95d9e6282f5b090431bf --tron-address 0x2C422313B1080E4FB2ED37600AB39822F7A707BB
 */

const TRON_ADDRESS = '0x2C422313B1080E4FB2ED37600AB39822F7A707BB';
// const ETH_ADDRESS = '0xD173313A51f8fc37BcF67569b463abd89d81844f';

const CONTRACT_ABI = [
    {
      "inputs": [],
      "stateMutability": "payable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "x",
          "type": "uint256"
        }
      ],
      "name": "set",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "get",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
];
// const CONTRACT_ADDRESS = '0xf09c30CF236609FF90871824Eb088ceBea632fE3';
// const GODWOKEN_RPC_URL = 'http://godwoken-testnet-web3-rpc.ckbapp.dev';
// const polyjuiceConfig = {
//     rollupTypeHash: '0x9b260161e003972c0b699939bc164cfdcfce7fd40eb9135835008dd7e09d3dae',
//     ethAccountLockCodeHash: '0xfcf093a5f1df4037cea259d49df005e0e7258b4f63e67233eda5b376b7fd2290',
//     web3Url: GODWOKEN_RPC_URL
// };
const CONTRACT_ADDRESS = '0xA48651c0E4561E585728D5B213fA0d6897A88c22'; // devnet
const GODWOKEN_RPC_URL = 'http://localhost:8024';
const polyjuiceConfig = {
    rollupTypeHash: '0x942df23916e205fbeed2949c76f9524f9d4ffe0b54ff11cdb8f66507bc5f4552',
    ethAccountLockCodeHash: '0x7e5909ed17a3cbd0d2038a4c714a281fbc236d993ef3a6de5cb762c7b73b36e9',
    web3Url: GODWOKEN_RPC_URL
};

const web3 = new Web3();
const godwoken = new GodwokenOld(GODWOKEN_RPC_URL);
const godwokenNew = new Godwoken(GODWOKEN_RPC_URL);
const godwoker = new Godwoker(GODWOKEN_RPC_URL, {
  godwoken: {
    eth_account_lock: {
      code_hash: polyjuiceConfig.ethAccountLockCodeHash,
      hash_type: 'type'
    },
    rollup_type_hash: polyjuiceConfig.rollupTypeHash
  }
});
const polyjuice = new Polyjuice(godwoken as any, {
  validator_script_hash: '0xab49f8edc5001ae21f17ecea94b13e66c8b4f4e7b2bfca3959213ad1b37a657e',
  sudt_id: 1,
  creator_account_id: 3,
});

web3.eth.accounts = new PolyjuiceAccounts(polyjuiceConfig);
const account = web3.eth.accounts.wallet.add(ACCOUNT_PRIVATE_KEY);

function toArrayBuffer(buf: any) {
  let ab = new ArrayBuffer(buf.length);
  let view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

async function getAccountIdByEthAddress(address: string) {
  const scriptHash = ethAddressToScriptHash(address);
  const id: number | undefined = await godwoken.getAccountIdByScriptHash(scriptHash);

  return id;
}

// async function assembleRawL2Transaction(eth_tx: EthTransaction) {
//     const from_id = await getAccountIdByEthAddress(eth_tx.from) // the godwoken account id for your tron address;
//     const to_id: string = await getAccountIdByContractAddress(godwoken, eth_tx.to) // your deployed contract account id;

//     console.log(eth_tx, {
//       from_id
//     });

//     if (!from_id || !eth_tx.gas || !eth_tx.gasPrice) {
//       throw new Error('assembleRawL2Transaction has missing properties');
//     }

//     const nonce = await godwoken.getNonce(from_id); // your godwoken account nonce;

//     const tx = polyjuice.generateTransaction(from_id, parseInt(to_id, 10), BigInt(eth_tx.gas), BigInt(eth_tx.gasPrice), BigInt(eth_tx.value), eth_tx.data, nonce);

//     return tx;
// }

function TxConfigValueTypeToString(value: any) {
  if (typeof value === "string") {
      value = "0x" + BigInt(value).toString(16);
  }
  if (typeof value === "number") {
      value = "0x" + BigInt(value).toString(16);
  }
  if (typeof value !== "string" || typeof value !== "number") {
      // BN.js type
      value = value.toString(16);
  }
  return value;
}

function formatEthTransaction({ from, to, value, gas, gasPrice, data, nonce }: any) {
  const ethTx = {
      from: from,
      to: to || `0x${"0".repeat(40)}`,
      value: value ? TxConfigValueTypeToString(value) : '0x00',
      gas: gas ? TxConfigValueTypeToString(gas) : '0xe4e1c0',
      gasPrice: gasPrice ? TxConfigValueTypeToString(gasPrice) : '0x00',
      data: data ? TxConfigValueTypeToString(data) : '0x00',
      nonce: nonce ? TxConfigValueTypeToString(nonce) : '0x1',
  };
  return ethTx;
}

function transactionConfigToPolyjuiceEthTransaction(tx: any) {
  let { from, to, value, gas, gasPrice, data, nonce } = tx;
  if (!from) {
      throw new Error("from is missing!");
  }
  if (typeof from === "number") {
      //todo: handle from is number
      throw new Error("todo: handle from is number case!");
  }
  return formatEthTransaction({ from, to, value, gas, gasPrice, data, nonce });
}

async function getAccountIdByTronAddress(address: string) {
  const scriptHash = tronAddressToScriptHash(address);
  console.log('getAccountIdByTronAddress', {
    scriptHash
  });
  const id: number | undefined = await godwoken.getAccountIdByScriptHash(scriptHash);

  return id;
}

async function assembleRawL2TransactionTron(eth_tx: any) {
  const from = await getAccountIdByTronAddress(eth_tx.from);

  console.log({
    from,
    eth_tx
  });

  if (!from || !eth_tx.gas || !eth_tx.gasPrice) {
    throw new Error('assembleRawL2Transaction has missing properties');
  }

  const to = await godwoker.allTypeEthAddressToAccountId(eth_tx.to);
  const nonce = await godwoker.getNonce(from);
  const encodedArgs = godwoker.encodeArgs(eth_tx);
  const tx = {
      from_id: "0x" + BigInt(from).toString(16),
      to_id: "0x" + BigInt(to).toString(16),
      args: encodedArgs,
      nonce: "0x" + BigInt(nonce).toString(16),
  };
  return tx;
}

function generateTransactionMessageToSignTron(raw_l2tx: any, _sender_script_hash: any, _receiver_script_hash: any, add_prefix = false) {
    const raw_tx_data = core.SerializeRawL2Transaction(
      NormalizeRawL2Transaction(raw_l2tx)
    );
    // @ts-ignore
    const rollup_type_hash = Buffer.from(godwoker.godwkenUtils.rollup_type_hash.slice(2), "hex");
    const sender_script_hash = Buffer.from(_sender_script_hash.slice(2), "hex");
    const receiver_script_hash = Buffer.from(
      _receiver_script_hash.slice(2),
      "hex"
    );

    const data = toArrayBuffer(
      Buffer.concat([
        rollup_type_hash,
        sender_script_hash,
        receiver_script_hash,
        toBuffer(raw_tx_data),
      ])
    );
    const message = utils.ckbHash(data).serializeJson();

    if (add_prefix === false) {
      // do not add `\x19Ethereum Signed Message:\n32` prefix when generating message
      // set true when you want to pass message for metamask signing,
      // metamask will add this automattically.

      return message;
    }

    const TRX_MESSAGE_HEADER = '\x19TRON Signed Message:\n32';

    const prefix_buf = Buffer.from(TRX_MESSAGE_HEADER);
    const buf = Buffer.concat([
      prefix_buf,
      Buffer.from(message.slice(2), "hex"),
    ]);
    return `0x${keccak256(buf).toString("hex")}`;
}

async function generateMessageFromEthTransactionTron(tx: any) {
  const { from, to } = tx;
  const to_id = await godwoker.allTypeEthAddressToAccountId(to);
  const sender_script_hash = tronAddressToScriptHash(from);
  console.log('generateMessageFromEthTransactionTron', {
    sender_script_hash
  });
  const receiver_script_hash = await godwoker.getScriptHashByAccountId(parseInt(to_id));
  const polyjuice_tx = await assembleRawL2TransactionTron(tx);

  const message = await generateTransactionMessageToSignTron(
    polyjuice_tx,
    sender_script_hash,
    receiver_script_hash,
    true
  );

  return message;
}

async function readCall() {
  const signedTx2 = await TronWeb.Trx.signString('0x123', ACCOUNT_PRIVATE_KEY, false);
  console.log({
    signedTx2
  });

  const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  const callData = contract.methods.set(125).encodeABI()

  const _tx = {
    from: TRON_ADDRESS,
    to: CONTRACT_ADDRESS,
    nonce: '0x0',
    gasPrice: '0x0',
    gas: '0x271110',
    value: '0x0',
    data: callData,
  };

  const tx = transactionConfigToPolyjuiceEthTransaction(_tx);

  console.log(`Write call start`);
  console.log({
    _tx,
    tx
  });

  const polyjuiceTx = await assembleRawL2TransactionTron(_tx);

  console.log({
    polyjuiceTx
  });

  const messageToSign = await generateMessageFromEthTransactionTron(_tx);

  console.log({
    messageToSign
  });


  const _signature = sign(messageToSign, ACCOUNT_PRIVATE_KEY);
  const signature = godwoker.packSignature(_signature);

  const l2_tx = { raw: polyjuiceTx, signature: signature };

  const signedTx = {
    messageToSign,
    v: "0x0",
    r: "0x0",
    s: signature,
    rawTransaction: godwoker.serializeL2Transaction(l2_tx),
    transactionHash: calcPolyjuiceTxHash(polyjuiceTx),
  }
  console.log({
    signedTx
  });

  // const signature = '0xe72931e0267fa3e571c5d3d074232dc7e6c68dda675befc28bc0e20c45bd46386b1d46b2d5b2cdc8f96d0df14189a78510e1c772c75703bd00a6b3944e1acd3c1b';

  console.log({
    _signature,
    signature
  });

  const result = await godwoker.gw_submitSerializedL2Transaction(signedTx.rawTransaction);
  console.log(result);

  await godwoker.waitForTransactionReceipt(signedTx.transactionHash);

  console.log('Receipt received');
}

function calcPolyjuiceTxHash(tx: any) {
  const tx_hash = utils.ckbHash(core.SerializeRawL2Transaction(NormalizeRawL2Transaction(tx))).serializeJson();
  return tx_hash;
}

// async function writeCall() {
//     const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

//     const tx = contract.methods.YOUR_WRITE_FUNCTION_NAME().send(
//         {
//             from: account.address,
//             to: '0x' + new Array(40).fill(0).join(''),
//             gas: 6000000,
//             gasPrice: '0',
//         }
//     );

//     tx.on('transactionHash', (hash: string) => console.log(`Write call transaction hash: ${hash}`));

//     const receipt = await tx;

//     console.log('Write call transaction receipt: ', receipt);
// }

(async () => {
    // const balance = BigInt(await web3.eth.getBalance(account.address));

    // if (balance === 0n) {
    //     console.log(`Insufficient balance. Can't issue a smart contract call. Please deposit funds to your Ethereum address: ${account.address}`);
    //     return;
    // }

    console.log('Calling contract...');

    // Check smart contract state before state change.
    await readCall();

    // Change smart contract state.
    // await writeCall();

    // Check smart contract state after state change.
    // await readCall();
})();

import { HexNumber, HexString, utils } from "@ckb-lumos/base";
import { L2Transaction, RawL2Transaction, Godwoken as GodwokenOld, core } from "../../godwoken/lib";
import { Polyjuice } from "../../polyjuice/lib";
import { _generateTransactionMessageToSign, _generateTransactionMessageToSignNoPrefix, _generateTransactionMessageToSignTron } from "./common";
import { ethAddressToScriptHash } from "./modules/godwoken";
import { Signer, Godwoker } from '@polyjuice-provider/base';
import { Godwoken } from '@polyjuice-provider/godwoken';
import { sign } from 'eth-lib/lib/account';
import { NormalizeRawL2Transaction } from "../../godwoken/lib/normalizer";
const Web3 = require('web3');
const { PolyjuiceAccounts } = require("@polyjuice-provider/web3");
const { getAccountIdByContractAddress } = require('./modules/godwoken');

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

// const TRON_ADDRESS = '0x2C422313B1080E4FB2ED37600AB39822F7A707BB';
const ETH_ADDRESS = '0xD173313A51f8fc37BcF67569b463abd89d81844f';

const ACCOUNT_PRIVATE_KEY = '0xd9066ff9f753a1898709b568119055660a77d9aae4d7a4ad677b8fb3d2a571e5'; // Replace this with your Ethereum private key with funds on Layer 2.
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
// const CONTRACT_ADDRESS = '0xf09c30CF236609FF90871824Eb088ceBea632fE3'; // testnet
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
  validator_script_hash: '0x1b46dee6a36e20314f35d09f8bd1c67fe5449cb67bc96603dd8a9fee4539660a',
  sudt_id: 1,
  creator_account_id: 3,
});

web3.eth.accounts = new PolyjuiceAccounts(polyjuiceConfig);
const account = web3.eth.accounts.wallet.add(ACCOUNT_PRIVATE_KEY);

async function getAccountIdByEthAddress(address: string) {
  const scriptHash = ethAddressToScriptHash(address);
  const id: number | undefined = await godwoken.getAccountIdByScriptHash(scriptHash);

  return id;
}

async function assembleRawL2Transaction(eth_tx: EthTransaction) {
    const from_id = await getAccountIdByEthAddress(eth_tx.from) // the godwoken account id for your tron address;
    const to_id: string = await getAccountIdByContractAddress(godwoken, eth_tx.to) // your deployed contract account id;

    if (!from_id || !eth_tx.gas || !eth_tx.gasPrice) {
      throw new Error('assembleRawL2Transaction has missing properties');
    }

    const nonce = await godwoken.getNonce(from_id); // your godwoken account nonce;

    const tx = polyjuice.generateTransaction(from_id, parseInt(to_id, 10), BigInt(eth_tx.gas), BigInt(eth_tx.gasPrice), BigInt(eth_tx.value), eth_tx.data, nonce);

    return tx;
}

async function generateGodwokenTransactionMessageToSign(rawTx: any, polyjuiceTx: any) {
  const sender_script_hash = ethAddressToScriptHash(rawTx.from);
  const receiver_script_hash = await godwoken.getScriptHash(parseInt(polyjuiceTx.to_id, 16));

  const message = await _generateTransactionMessageToSignNoPrefix(
    polyjuiceTx,
    polyjuiceConfig.rollupTypeHash,
    sender_script_hash,
    receiver_script_hash
  );

  return message;
}

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

async function readCall() {
  const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  const callData = contract.methods.set(217).encodeABI()

  // from: '0xD173313A51f8fc37BcF67569b463abd89d81844f',
  // to: '0xf09c30cf236609ff90871824eb088cebea632fe3',
  // value: '0x00',
  // gas: '0x5b8d80',
  // gasPrice: '0x0',
  // data: '0x60fe47b100000000000000000000000000000000000000000000000000000000000001bc',
  // nonce: '0x1'

  const _tx = {
      from: ETH_ADDRESS,
      to: CONTRACT_ADDRESS,
      value: '0x00',
      gas: '0x5b8d80',
      gasPrice: '0x0',
      data: callData,
                // 0x60fe47b10000000000000000000000000000000000000000000000000000000000000309
      // data: '0x60fe47b100000000000000000000000000000000000000000000000000000000000001bc',//callData,
      nonce: '0x1',
  };

  const tx = transactionConfigToPolyjuiceEthTransaction(_tx);

  console.log(`Write call start`);
  console.log({
    _tx,
    tx
  });

  const polyjuiceTx = await godwoker.assembleRawL2Transaction(_tx);

  console.log({
    polyjuiceTx
  });

  const messageToSign = await godwoker.generateMessageFromEthTransaction(_tx);

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
};

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

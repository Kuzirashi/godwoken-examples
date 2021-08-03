import { HexNumber, HexString, utils } from "@ckb-lumos/base";
import { Godwoken as GodwokenOld, core, toBuffer } from "../../godwoken/lib";
import { _generateTransactionMessageToSign, _generateTransactionMessageToSignNoPrefix, _generateTransactionMessageToSignTron } from "./common";
import { tronAddressToScriptHash } from "./modules/godwoken";
import { Godwoker } from '@polyjuice-provider/base';
import { NormalizeRawL2Transaction } from "../../godwoken/lib/normalizer";
const Web3 = require('web3');
const keccak256 = require("keccak256");
import { utils as ethersUtils } from "ethers";

const ACCOUNT_PRIVATE_KEY = '0x5789d39fd2ce1978a857fa3cf86555ae8fc8b12a8106191b7f4a6b43808b134f'; // Replace this with your Ethereum private key with funds on Layer 2.

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
 * - TRON_ADDRESS
 * - <YOUR_CONTRACT_ADDRESS>
 */

const TRON_ADDRESS = '0x2C422313B1080E4FB2ED37600AB39822F7A707BB';

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
const CONTRACT_ADDRESS = '0x3E3b7616812290B60ceEcF412C9CDf941Da841A9';
const GODWOKEN_RPC_URL = 'http://godwoken-testnet-web3-rpc.ckbapp.dev';
const polyjuiceConfig = {
    rollupTypeHash: '0x4cc2e6526204ae6a2e8fcf12f7ad472f41a1606d5b9624beebd215d780809f6a',
    ethAccountLockCodeHash: '0xdeec13a7b8e100579541384ccaf4b5223733e4a5483c3aec95ddc4c1d5ea5b22',
    web3Url: GODWOKEN_RPC_URL
};

const web3 = new Web3();
const godwoken = new GodwokenOld(GODWOKEN_RPC_URL);
const godwoker = new Godwoker(GODWOKEN_RPC_URL, {
  godwoken: {
    eth_account_lock: {
      code_hash: polyjuiceConfig.ethAccountLockCodeHash,
      hash_type: 'type'
    },
    rollup_type_hash: polyjuiceConfig.rollupTypeHash
  }
});

function toArrayBuffer(buf: any) {
  let ab = new ArrayBuffer(buf.length);
  let view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
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

async function writeCall() {
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

  const signingKey = new ethersUtils.SigningKey(ACCOUNT_PRIVATE_KEY);

  const messageToSign = await generateMessageFromEthTransactionTron(_tx);

  console.log({
    messageToSign
  });


  const _signature = signingKey.signDigest(messageToSign);
  const signatureHex = [
      '0x',
      _signature.r.substring(2),
      _signature.s.substring(2),
      Number(_signature.v).toString(16)
  ].join('');
  const signature = godwoker.packSignature(signatureHex);

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

  console.log({
    _signature,
    signature
  });

  const result = await godwoker.gw_submitSerializedL2Transaction(signedTx.rawTransaction);
  console.log(result);

  console.log(`Waiting for tx receipt doesn't work for Tron calls, but if transaction was submitted then you can check the smart-contract state after 120s and the state should be changed successfully.`);
  // await godwoker.waitForTransactionReceipt(signedTx.transactionHash);

  // console.log('Receipt received');
}

function calcPolyjuiceTxHash(tx: any) {
  const tx_hash = utils.ckbHash(core.SerializeRawL2Transaction(NormalizeRawL2Transaction(tx))).serializeJson();
  return tx_hash;
}

(async () => {
    console.log('Calling contract...');

    // Change smart contract state.
    await writeCall();
})();

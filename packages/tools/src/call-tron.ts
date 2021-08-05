import { HexNumber, HexString, utils } from "@ckb-lumos/base";
import { core, toBuffer } from "../../godwoken/lib";
import { _generateTransactionMessageToSign, _generateTransactionMessageToSignNoPrefix, _generateTransactionMessageToSignTron } from "./common";
import { tronAddressBase58ToHex, tronAddressHexToScriptHash } from "./modules/godwoken";
import { Godwoker } from '@polyjuice-provider/base';
import { NormalizeRawL2Transaction } from "../../godwoken/lib/normalizer";
const Web3 = require('web3');
const keccak256 = require("keccak256");
import { utils as ethersUtils } from "ethers";

const ACCOUNT_PRIVATE_KEY = '0x45777e4dbd55d4f4db25b7f3b4c7d8ac38677b4e6a4d74030b787ef63c2a29bb'; // Replace this with your Tron private key with funds on Layer 2.

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

const TRON_ADDRESS = 'TFrSJCrSJai8H2Kc32TP3nEzuWsXu8YnUJ';
const tronAddressHex = tronAddressBase58ToHex(TRON_ADDRESS);

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

async function getAccountIdByTronAddressHex(address: string) {
  const scriptHash = tronAddressHexToScriptHash(address);
  const id: number | undefined = parseInt(await godwoker.getAccountIdByScriptHash(scriptHash));

  return id;
}

async function assembleRawL2TransactionTron(eth_tx: any) {
  const from = await getAccountIdByTronAddressHex(eth_tx.from);

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
  const sender_script_hash = tronAddressHexToScriptHash(from);

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

  const tx = {
    from: tronAddressHex,
    to: CONTRACT_ADDRESS,
    nonce: '0x0',
    gasPrice: '0x0',
    gas: '0x271110',
    value: '0x0',
    data: callData,
  };


  console.log(`Write call start`);
  console.log({
    tx
  });

  const polyjuiceTx = await assembleRawL2TransactionTron(tx);

  console.log({
    polyjuiceTx
  });

  const signingKey = new ethersUtils.SigningKey(ACCOUNT_PRIVATE_KEY);

  const messageToSign = await generateMessageFromEthTransactionTron(tx);

  console.log({
    messageToSign
  });


  const _signature = signingKey.signDigest(messageToSign);
  const signature = [
      '0x',
      _signature.r.substring(2),
      _signature.s.substring(2),
      Number(_signature.v).toString(16)
  ].join('');

  const l2_tx = { raw: polyjuiceTx, signature: signature };

  const signedTx = {
    messageToSign,
    v: "0x0",
    r: "0x0",
    s: signature,
    rawTransaction: godwoker.serializeL2Transaction(l2_tx),
    transactionHash: calcPolyjuiceTxHash(polyjuiceTx),
  }

  const result = await godwoker.gw_submitSerializedL2Transaction(signedTx.rawTransaction);
  console.log(result);

  console.log(`Waiting for tx receipt doesn't work for Tron calls, but if transaction was submitted then you can check the smart-contract state after 120s and the state should be changed successfully.`);
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

import { HexNumber, HexString } from "@ckb-lumos/base";
import { L2Transaction, RawL2Transaction } from "../../godwoken/lib";
import { Polyjuice } from "../../polyjuice/lib";
import { _generateTransactionMessageToSignTron } from "./common";
import { tronAddressToScriptHash } from "./modules/godwoken";

const Web3 = require('web3');
const { PolyjuiceAccounts } = require("@polyjuice-provider/web3");
const { getAccountIdByContractAddress } = require('./modules/godwoken');
const { Godwoken } = require("@godwoken-examples/godwoken");

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

const TRON_ADDRESS = '0x2C422313B1080E4FB2ED37600AB39822F7A707BB';

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
const CONTRACT_ADDRESS = '0xf09c30CF236609FF90871824Eb088ceBea632fE3';

const GODWOKEN_RPC_URL = 'http://godwoken-testnet-web3-rpc.ckbapp.dev';
const polyjuiceConfig = {
    rollupTypeHash: '0x9b260161e003972c0b699939bc164cfdcfce7fd40eb9135835008dd7e09d3dae',
    ethAccountLockCodeHash: '0xfcf093a5f1df4037cea259d49df005e0e7258b4f63e67233eda5b376b7fd2290',
    web3Url: GODWOKEN_RPC_URL
};
  
const web3 = new Web3();
const godwoken = new Godwoken(GODWOKEN_RPC_URL);
const polyjuice = new Polyjuice(godwoken, {
  validator_script_hash: '0x1b46dee6a36e20314f35d09f8bd1c67fe5449cb67bc96603dd8a9fee4539660a',
  sudt_id: 0,
  creator_account_id: 3,
});

web3.eth.accounts = new PolyjuiceAccounts(polyjuiceConfig);
// const account = web3.eth.accounts.wallet.add(ACCOUNT_PRIVATE_KEY);

async function getAccountIdByTronAddress(address: string) {
  const scriptHash = tronAddressToScriptHash(address);
  const id: number | undefined = await godwoken.getAccountIdByScriptHash(scriptHash);

  return id;
}

async function assembleRawL2Transaction(eth_tx: EthTransaction) {
    const from_id = await getAccountIdByTronAddress(eth_tx.from) // the godwoken account id for your tron address;
    const to_id: string = await getAccountIdByContractAddress(godwoken, eth_tx.to) // your deployed contract account id;
    const nonce = await godwoken.getNonce(from_id); // your godwoken account nonce;

    if (!from_id || !eth_tx.gas || !eth_tx.gasPrice) {
      throw new Error('assembleRawL2Transaction has missing properties');
    }

    const tx = polyjuice.generateTransaction(from_id, parseInt(to_id, 10), BigInt(eth_tx.gas), BigInt(eth_tx.gasPrice), BigInt(eth_tx.value), eth_tx.data, nonce);

    return tx;
}

async function generateGodwokenTransactionMessageToSign(rawTx: any, polyjuiceTx: any) {
  const sender_script_hash = tronAddressToScriptHash(rawTx.from);
  const receiver_script_hash = await godwoken.getScriptHash(parseInt(polyjuiceTx.to_id, 16));

  const message = await _generateTransactionMessageToSignTron(
    polyjuiceTx,
    polyjuiceConfig.rollupTypeHash,
    sender_script_hash,
    receiver_script_hash
  );

  return message;
}

async function readCall() {
  const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  const callData = contract.methods.get().encodeABI()

  const eth_tx_to_call_contract = {
      from: TRON_ADDRESS,
      to: CONTRACT_ADDRESS,
      nonce: '0x0',
      gasPrice: '0x0',
      gas: '0x271110',
      value: '0x0',
      data: callData,
  };

  console.log(`Read call result`);
  console.log(eth_tx_to_call_contract);

  const polyjuiceTx: RawL2Transaction = await assembleRawL2Transaction(eth_tx_to_call_contract);

  console.log({
    polyjuiceTx
  });

  const messageToSign = await generateGodwokenTransactionMessageToSign(eth_tx_to_call_contract, polyjuiceTx);

  console.log({
    messageToSign
  });

  const signature = '0xe72931e0267fa3e571c5d3d074232dc7e6c68dda675befc28bc0e20c45bd46386b1d46b2d5b2cdc8f96d0df14189a78510e1c772c75703bd00a6b3944e1acd3c1b';

  const signedTx: L2Transaction = {
    raw: polyjuiceTx,
    signature 
  }

  const result = await godwoken.executeL2Transaction(signedTx);
  console.log(result);
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

# Run Godwoken + Polyjuice on devchain

Following instructions were run on Ubuntu 20.04 LTS. You need a browser with [MetaMask wallet](https://metamask.io/) to run the demo.

## Constants

Whenever you see following constants please replace them with their respective values:
```
GENESIS_1_PRIVATE_KEY=0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc
TOP_DIR=/home/<USERNAME>/projects/ckb-dev/godwoken
ETH_ADDRESS=<COPY AND PASTE HERE YOUR ADDRESS FROM METAMASK, eg. 0x8399a328a027a88d65198a0580e6fb07168c21da>
```

## 1. Start CKB Dev blockchain

First, download CKB binary.

```
cd ~
mkdir projects
curl -O https://github.com/nervosnetwork/ckb/releases/download/v0.40.0/ckb_v0.40.0_x86_64-unknown-linux-gnu.tar.gz -L
tar -xvzf ckb_v0.40.0_x86_64-unknown-linux-gnu.tar.gz
mv ckb_v0.40.0_x86_64-unknown-linux-gnu ckb-0.40
```

Now, add CKB binary to path. Open editor:

```
nano ~/.bashrc
```

And add the following line at the end (note that I've put ckb-0.40 directory in `projects` folder, adjust it for your setup):

```
alias ckb='~/projects/ckb-0.40/ckb'
```

Now restart terminal session and run:

```
ckb
```

It should print help information for CKB binary. If it doesn't work and system can't find the `ckb` command something is misconfigured. Working example:
```
➜  ckb
ckb 0.40.0
Nervos Core Dev <dev@nervos.org>
Nervos CKB - The Common Knowledge Base

USAGE:
    ckb [OPTIONS] <SUBCOMMAND>

FLAGS:
    -h, --help       Prints help information
    -V, --version    Prints version information

OPTIONS:
    -C <path>        Runs as if ckb was started in <path> instead of the current working directory.

SUBCOMMANDS:
    export         Exports ckb data
    help           Prints this message or the help of the given subcommand(s)
    import         Imports ckb data
    init           Creates a CKB direcotry or reinitializes an existing one
    list-hashes    Lists well known hashes
    migrate        Runs ckb migration
    miner          Runs ckb miner
    peer-id        About peer id, base on Secp256k1
    replay         replay ckb process block
    reset-data     Truncate the database directory
                   Example:
                   ckb reset-data --force --database
    run            Runs ckb node
    stats          Statics chain information
                   Example:
                   ckb -C <dir> stats --from 1 --to 500
```

### Configure dev chain

At this point `ckb` should be installed. We will setup dev chain in `~/projects/ckb-dev/chain` directory. Therefore run:

```
cd ~/projects
mkdir ckb-dev
cd ckb-dev
ckb init -c dev -C chain
```

We've created setup data for dev chain but we need to adjust some stuff to make it more feasible to work with the chain. At the end of `~/projects/ckb-dev/ckb.toml` add:
```
[block_assembler]
code_hash = "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8"
args = "0xdb57a16a080dc07f19eaccbf6e0377fb348766a9"
hash_type = "type"
message = "0x"
```

I'm not going to customize it further for simplicity of this example. If you want to learn more how you can tweak it check [this documentation page](https://docs.nervos.org/docs/basics/guides/devchain) which does a great job at it.

### Run dev chain node and miner

Start in new terminal:
```
cd ~/projects/ckb-dev/chain
ckb run
```

Start in new terminal:
```
cd ~/projects/ckb-dev/chain
ckb miner
```

## 2. Setup CKB indexer

We need this later so PW-SDK can query blockchain and index data.

Install:
```
cd ~/projects
git clone git@github.com:nervosnetwork/ckb-indexer.git
sudo apt-get install libssl-dev
cargo build --release
```

Start in new terminal:
```
cd ~/projects/ckb-indexer
RUST_LOG=info ./target/release/ckb-indexer -s /tmp/ckb-indexer-test
```


## 3. Setup Godwoken on dev chain

This setup was tested on 0.1.x branch of Godwoken.

[Follow these instructions to setup Godwoken on dev chain.](https://github.com/nervosnetwork/godwoken/blob/master/docs/dev_chain.md)

Note that I've set up `godwoken_config.json`, `lumos-config.json`, `runner_config.json` file in `~/projects/ckb-dev/godwoken`.

Here is how you can start runner, but for now **don't do it**. Since we're using the same private key for Godwoken node and for setup scripts it conflicts when sending transaction if the Godwoken node is running. We will start it later after we deploy pw lock and setup our ETH account with CKB.
```
TOP=TOP_DIR; LUMOS_CONFIG_FILE=$TOP/lumos-config.json node packages/runner/lib/index.js --private-key GENESIS_1_PRIVATE_KEY -c $TOP/runner_config.json -s "postgresql://user:password@127.0.0.1:5432/lumos"
```


## 4. Setup godwoken-examples

```
cd ~/projects
git clone git@github.com:nervosnetwork/godwoken-examples.git
cd godwoken-examples
yarn
TOP=TOP_DIR; cp $TOP/runner_config.json packages/demo/src/configs/runner_config.json
cp packages/demo/src/configs/config.json.sample packages/demo/src/configs/config.json
```

### Deploy PW Lock

Build the project and deploy pw lock:
```
yarn workspace @godwoken-examples/godwoken tsc && yarn workspace @godwoken-examples/demo clean-cli && yarn workspace @godwoken-examples/demo build-cli
TOP=TOP_DIR; LUMOS_CONFIG_FILE=$TOP/lumos-config.json node ./packages/demo/build-cli/cli/deploy-pw-lock.js --private-key GENESIS_1_PRIVATE_KEY
```

After running this command open `packages/demo/src/configs/pw-dev-config.ts` and update `pwLock.cellDep` outpoint tx hash with the transaction hash received from deploying pw lock.

### Send some CKB to your ETH address

Send some CKB to your ETH address (copy the address from MetaMask) on Layer 1 that you're going to be using:

```
TOP=TOP_DIR; LUMOS_CONFIG_FILE=$TOP/lumos-config.json node ./packages/demo/build-cli/cli/send-ckb-to-eth-address.js --private-key GENESIS_1_PRIVATE_KEY -l ETH_ADDRESS
```

### Start Godwoken node

Run:
```
TOP=TOP_DIR; LUMOS_CONFIG_FILE=$TOP/lumos-config.json node packages/runner/lib/index.js --private-key GENESIS_1_PRIVATE_KEY -c $TOP/runner_config.json -s "postgresql://user:password@127.0.0.1:5432/lumos"
```

### Start demo website

```
yarn workspace @godwoken-examples/godwoken tsc                                              
yarn workspace @godwoken-examples/demo clean && yarn workspace @godwoken-examples/demo build && yarn workspace @godwoken-examples/demo start
```

Visit page:
```
http://localhost:9000/html/
```

1. Deposit CKB into layer 2 (has to be higher amount than 400)
2. Wait 120s and refresh page
3. You can verify that deposit has succeeded by clicking "Get" in "Balance" tab. Make sure that you check CKB balance.

![](https://i.imgur.com/2rgSSQf.png)

### Find Godwoken account id

For next steps you need to know your Godwoken account id. This id is assigned as a result of "Deposit" action. You can think of this as your Layer 2 address. It corresponds to your Ethereum address and CKB address.

There are few ways to find out your Godwoken account id. The easiest one is to refresh a page after you deposited CKB into layer 2 and then open "Dev tools" in your browser.

![](https://i.imgur.com/veluAaO.png)


### Create "creator account" for Polyjuice:

After deposit succeeded, we need to create Polyjuice backend on Godwoken. To do this, run this command:

```
node packages/tools/lib/polyjuice-cli.js createCreatorAccount GODWOKEN_ACCOUNT_ID 1 ROLLUP_TYPE_HASH ETHEREUM_ACCOUNT_PRIVATE_KEY
```

where:

- `GODWOKEN_ACCOUNT_ID` is a result of "Deposit" action, eg. `7`. See "Find Godwoken account id" section for more information.
- `ROLLUP_TYPE_HASH` you can get it when Godwoken node.js runner starts or if you open console in dev tools in browser on demo page
- `ETHEREUM_ACCOUNT_PRIVATE_KEY` you can get it from MetaMask if you go to "Account details" -> "Export private key"

As a result of running this script you should receive new account id. This is the account that you have to use as "creator account id" in "Deploy SimpleStorage" example. This will deploy Solidity smart contract to Polyjuice. Also update `packages/demo/src/configs/config.json` simple_storage_account_id with this new value of "creator account id".

Fill in the fields in "Deploy SimpleStorage" and press deploy. I have put 500 CKB in Shannons as value. Press "Deploy". You should receive an alert that your transaction has been submitted:

![](https://i.imgur.com/pM7f3Yj.png)

Close the alert. After closing you may see that "Deployed contract account id: null. Please click here to query later." Wait some time and click on text "Please click here to query later". "Deployed contract account id" should now load:

![](https://i.imgur.com/J8u4DKY.png)

#### Get value from smart contract

Now you can call the smart contract using "Deployed contract account id". Go to "SimpleStorage Get", set "contract account id" to "Deployed contract account id". Click "Get". MetaMask account will popup and you will have to sign the message. After signing you should see default value "123" next to "Get" button.

![](https://i.imgur.com/J6VnSuU.png)


#### Set value in smart contract

Call the smart contract to set the data. Go to "SimpleStorage Set", set "contract account id" to "Deployed contract account id". Set "value" field to "0". Set "set value" field to example value, like "7778". Click "Set".

Sign the message in MetaMask:

![](https://i.imgur.com/po31SQR.png)

You should see success alert:

![](https://i.imgur.com/Ar0Ojm0.png)

Wait 120s. Go to "SimpleStorage Get" section and click "Get" again. Sign the message. You should see updated value now:

![](https://i.imgur.com/0bMwhCx.png)


### Other

- It's impossible to use CKB CLI to check PW locked/ETH address capacity on layer 1 with `wallet get-capacity --address`. Instead use: `wallet get-capacity --lock-hash 0x4ead0ca7399339598a4dc8e5828646b363efa17b0454c37fd0161b89c49e5432` where lock-hash is lock hash of PW lock for concrete ETH address.
- The first 32bytes of deposit lock.args should match the rollup type script hash, otherwise the rollup instance coundn't find the deposit cell.
If the 32-bytes lock.args is not match the rollup type script hash, then you must have mistakes in the config file or cli command.

SimpleStorage Solidity code:

```
pragma solidity >=0.4.0 <0.7.0;

contract SimpleStorage {
  uint storedData;

  constructor() public payable {
    storedData = 123;
  }

  function set(uint x) public payable {
    storedData = x;
  }

  function get() public view returns (uint) {
    return storedData;
  }
}
```
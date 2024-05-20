'use strict';

import { HoneypotIsV1 } from '@normalizex/honeypot-is';
import Web3 from "web3";
import { config as configureDotenv } from "dotenv";
import { ethers } from "ethers";
import { Telegraf } from "telegraf";
import { isContractVerified } from "./abi.js"; //import Function
import { getTotalSupply } from './totalSupply.js';//import function
import * as factoryABI from "../abi/uniswap_factory_abi.json" assert { type: "json" };//json object
import * as erc20Abi from "../abi/erc20Abi.json" assert { type: "json" };//json object
configureDotenv({ path: '../private/file.env' });

const webSocketEndPointUrl = process.env.BASE_ENDPOINT;
const httpEndPointUrl = process.env.BASE_HTTP_PROVIDER;
const UniswapV2FActoryAddr = process.env.UNISWAP_V2_FACTORY_ADDRESS;
const token = process.env.BOT_TOKEN;
const channelId = '@newpairs_base';
const webSocketProvider = new Web3.providers.WebsocketProvider(
  webSocketEndPointUrl
);
const web3 = new Web3(webSocketProvider);
const customHttpProvider = new ethers.JsonRpcProvider(httpEndPointUrl);
const factoryContract = new web3.eth.Contract(
  factoryABI.default,
  UniswapV2FActoryAddr
);
const bot = new Telegraf(token);

webSocketProvider.on('connect', () => {
  console.log(`Connected to WebSocket provider`);
});
webSocketProvider.on('disconnect', () => {
  console.error(`Disconnected from WebSocket provider`);
});

// => Get transaction hash
async function fetchTransactionReceipt(txHash) {
  try {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    const deployerAddr = receipt.from;
    return deployerAddr;
  } catch (error) {
    if (error.code === 430) {
      console.error('Transaction not found:', txHash);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
}
// =>  subscribe to pairCreated event
async function subscribeToPairCreatedEvent() {
  try {
    console.log('Provider connected');

    if (factoryContract && factoryContract.events) {
      const subscription = factoryContract.events.PairCreated({
        fromBlock: 'latest'
      });

      subscription.on('data', async event => {
        const tHash = event.transactionHash;
        //extract the deployer address
        const deployerAddress = await fetchTransactionReceipt(tHash);
        //check dev token bal
        const _token0 = await event.returnValues.token0;
        const _token1 = await event.returnValues.token1;
        const addresses = [_token0, _token1];
        const pair = await event.returnValues.pair;

        //base uni V2 factory address
        const specificAddr = '0x4200000000000000000000000000000000000006';
        for (let address of addresses) {
          if (address !== specificAddr) {
            const token1Address = await address;
            const tokenContract = new ethers.Contract(
              token1Address,
              erc20Abi.default,
              customHttpProvider
            );
            //fetch token total supply function, called with token contract address
            try {
              const totalSupply = await getTotalSupply(tokenContract);
              // function to fetch dev token balance
              async function checkDeployerAddr(deployerAddress) {
                try {
                  const balance = await tokenContract.balanceOf(
                    deployerAddress
                  );
                  const value = ethers.formatEther(balance);
                  return value;
                } catch (err) {
                  console.error('Error fetching token balance:', err);
                }
              }
              //dev tokens amount
              const devTokenBal = await checkDeployerAddr(deployerAddress);

              // Calculate dev total holdings of supply
              const devHolding = (devTokenBal / totalSupply) * 100;
              //name && symbol
              const name = await tokenContract.name();
              const symbol = await tokenContract.symbol();
              const privKey = process.env.WALLET_PRIVATE_KEY;
              const wallet = new ethers.Wallet(privKey, customHttpProvider);
              // Get the signer from the wallet
              const signer = wallet.connect(customHttpProvider);
              const abi = [
                'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
              ];
              const factoryContract0 = new ethers.Contract(
                UniswapV2FActoryAddr,
                [
                  'event PairCreated(address indexed token0, address indexed token1,address pair, uint)',
                  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
                  'function balanceOf(address owner) external view returns (uint)',
                  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
                ],
                signer
              );
              const pairAddress0 = await factoryContract0.getPair(
                specificAddr,
                token1Address
              );
              const pairContract = new ethers.Contract(
                pairAddress0,
                abi,
                customHttpProvider
              );
              const reserves = await pairContract.getReserves();
              const reserve_0 = await reserves.reserve0;
              const marketCap = web3.utils.fromWei(reserve_0, 'ether');
              const reserve_1 = await reserves.reserve1;
              const liquidity = web3.utils.fromWei(reserve_1, 'ether');
              const erc20TokenPercent = totalSupply * 0.4;
              const CHAIN_ID = 8453;
              const honeypotis = new HoneypotIsV1();

              try {
                const PAIRS = await honeypotis.getPairs(
                  token1Address,
                  CHAIN_ID
                );
                const req = await honeypotis.honeypotScan(
                  address,
                  PAIRS[0].Router,
                  PAIRS[0].Pair,
                  CHAIN_ID
                );
                const res = req;
                (async () => {
                  const isVerified = await isContractVerified(token1Address);
                  if (
                    reserves !== null &&
                    isVerified 
                  ) {
                    //&& devHolding > 0.9 && devHolding < 51
                    if (res.IsHoneypot !== true &&
                    totalSupply > 0 &&
                    liquidity >= erc20TokenPercent &&
                    marketCap >= 0.2) {
                      const str = `\n
              Name: ${name}  (${symbol})\nCA: ${token1Address}\nToken Supply: ${totalSupply}\nDeployer Address: ${deployerAddress}\n Pair Address: ${pair}\nDev holds: ${
                        isNaN(devHolding)
                          ? 0 + '%'
                          : parseInt(devHolding.toFixed(3)) + '%'
                      } of tokens supply\n DexScreener: ${'https://dexscreener.com/base/' +
                        pair}\nliquidity: ${parseFloat(liquidity).toFixed(4) +
                        ' ' +
                        symbol}\nmarketCap: ${marketCap} ETH\n`;                      
                      bot.telegram.sendMessage(channelId, str);
                    }
                  } else return;
                })();
              } catch (err) {
                return;
              }
            } catch (err) {
              return;
            }
          }
        }
      });

      subscription.on('error', error => {
        console.error('Error in PairCreated event subscription:', error);
      });
    } else {
      console.error('Factory contract or events not properly defined.');
    }
  } catch (error) {
    console.warn;
  }
}
subscribeToPairCreatedEvent();
bot.launch();

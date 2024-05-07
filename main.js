"use strict";

import Web3 from "web3";
import { config as configureDotenv } from "dotenv";
import { ethers } from "ethers";
import TelegramBot from "node-telegram-bot-api";
import { isContractVerified } from "./abi.js"; //import Function
import * as factoryABI from "./uniswap_factory_abi.json" assert { type: "json" };//json object
import * as erc20Abi from "./erc20Abi.json" assert { type: "json" };//json object
configureDotenv({ path: "./file.env" });

const webSocketEndPointUrl = process.env.BASE_ENDPOINT;
const httpEndPointUrl = process.env.BASE_HTTP_PROVIDER;
const UniswapV2FActoryAddr = process.env.UNISWAP_V2_FACTORY_ADDRESS;
const token = process.env.BOT_TOKEN;
// const chadId = process.env.CHAT_ID;
const webSocketProvider = new Web3.providers.WebsocketProvider(
  webSocketEndPointUrl
);
const bot = new TelegramBot(token, { polling: true });
const web3 = new Web3(webSocketProvider);
const customHttpProvider = new ethers.JsonRpcProvider(httpEndPointUrl);
const factoryContract = new web3.eth.Contract(
  factoryABI.default,
  UniswapV2FActoryAddr
);

webSocketProvider.on("connect", () => {
  console.log(`Connected to WebSocket provider`);
});
webSocketProvider.on("disconnect", () => {
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
      console.error("Transaction not found:", txHash);
    } else {
      console.error("An unexpected error occurred:", error);
    }
  }
}

// => Get total supply
async function getTotalSupply(tContract) {
  try {
    const totalSupplyBigNumber = await tContract.totalSupply();
    const tokenSupply = ethers.formatUnits(totalSupplyBigNumber, 18);

    const strippedTokenSupply = parseInt(tokenSupply);

    // console.log(`Total supply: ${strippedTokenSupply}`);
    return strippedTokenSupply;
  } catch (error) {
    console.error("Error fetching total supply:", error);
  }
}

// =>  subscribe to pairCreated event
async function subscribeToPairCreatedEvent() {
  try {
    console.log("Provider connected");

    if (factoryContract && factoryContract.events) {
      const subscription = factoryContract.events.PairCreated({
        fromBlock: "latest",
      });

      subscription.on("data", async event => {
        //get transaction hash
        const tHash = event.transactionHash;
        //extract the deployer address
        const deployerAddress = await fetchTransactionReceipt(tHash);
        //check dev token bal
        const _token0 = await event.returnValues.token0;
        const _token1 = await event.returnValues.token1;
        const addresses = [_token0, _token1];
        const pair = await event.returnValues.pair;

        const specificAddr = "0x4200000000000000000000000000000000000006";
        for (let address of addresses) {
          if (address !== specificAddr) {
            const token1Address = await address;
            const tokenContract = new ethers.Contract(
              token1Address,
              erc20Abi.default,
              customHttpProvider
            );
            //fetch token total supply function, called with token contract address
            const totalSupply = await getTotalSupply(tokenContract);
            // function to fetch dev token balance
            async function checkDeployerAddr(deployerAddress) {
              try {
                const balance = await tokenContract.balanceOf(deployerAddress);
                const value = ethers.formatEther(balance);
                return value;
              } catch (err) {
                console.error("Error fetching token balance:", err);
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
              "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            ];
            const factoryContract0 = new ethers.Contract(
              UniswapV2FActoryAddr,
              [
                "event PairCreated(address indexed token0, address indexed token1,address pair, uint)",
                "function getPair(address tokenA, address tokenB) external view returns (address pair)",
                "function balanceOf(address owner) external view returns (uint)",
                "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
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
            const marketCap = web3.utils.fromWei(reserve_0, "ether");
            const reserve_1 = await reserves.reserve1;
            const liquidity = web3.utils.fromWei(reserve_1, "ether");
            const erc20TokenPercent = totalSupply * 0.7;

            (async () => {
              const isVerified = await isContractVerified(token1Address);
                if (reserves !== null) {
              if (
                isVerified &&
                liquidity >= erc20TokenPercent &&
                marketCap >= 0.2 &&
                marketCap <= 11
              ) {
              const str = `
              Name:             ${name}  (${symbol})\n
              CA:               ${token1Address}\n 
              Token Supply:     ${totalSupply}\n 
              Deployer Address: ${deployerAddress}\n 
              Pair Address:     ${pair}\n 
              Dev holds:        ${
                isNaN(devHolding) ? 0 : parseInt(devHolding) + "%"
              } of tokens supply\n 
              DexScreener:      ${"https://dexscreener.com/base/" + pair}\n
              liquidity         ${liquidity + symbol}\n
              marketCap         ${marketCap}ETH\n
              `;                
              bot.on("message", msg => {
                const chatId = msg.chat.id;
                console.log("Received message:", msg.text);

                // Reply to the message
                bot.sendMessage(chatId, str);
              });
              console.log(str);
              console.log(`..............................................`);
              }
                } else return;
            })();
          }
        }
      });

      subscription.on("error", error => {
        console.error("Error in PairCreated event subscription:", error);
      });
    } else {
      console.error("Factory contract or events not properly defined.");
    }
  } catch (error) {
    console.warn;
  }
}
subscribeToPairCreatedEvent();

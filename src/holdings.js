'use strict';

import fetch from 'node-fetch';
import { Telegraf } from 'telegraf';
import { getTotalSupply } from './totalSupply.js'; //import function
import { ethers } from 'ethers';
import * as erc20Abi from "../abi/erc20Abi.json" assert { type: "json" };//json object
import { config as configureDotenv } from 'dotenv';

configureDotenv({ path: '../private/file.env' });
const key = process.env.CHAINBASE_KEY;
const token = process.env.HOLDERS_CHECKER;
const httpEndPointUrl = process.env.BASE_HTTP_PROVIDER;
const bot = new Telegraf(token);
const chainId = 8453;
const customHttpProvider = new ethers.JsonRpcProvider(httpEndPointUrl);
export async function getTokenHolders(contractAddress, limit) {
  try {
    if (!key) {
      throw new Error('base chain key variable not set');
    }
    const response = await fetch(
      `https://api.chainbase.online/v1/token/top-holders?chain_id=${chainId}&contract_address=${contractAddress}&page=1&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': key,
          accept: 'application/json'
        }
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

const limit = 10;
bot.hears(/^\/h (0x[0-9a-fA-F]{40})$/, async ctx => {
  const chatId = ctx.chat.id;
  const address = ctx.match[1];
  const tokenContract = new ethers.Contract(
    address,
    erc20Abi.default,
    customHttpProvider
  );
  const totalSupply = await getTotalSupply(tokenContract);
  let retry = 0;
  const retryCount = 3;
  while (retry < retryCount) {
    try {
      const data = await getTokenHolders(address, limit);// get token holders function
      if (data && data.data && data.data.length > 1) {
        const sortedData = data.data.sort((a, b) => b.amount - a.amount); // Sort data in descending order
        const topHolders = sortedData.slice(0, limit); // Get top holders based on the limit
        for (const holder of topHolders) {
          const balancePercentage = (holder.amount / totalSupply) * 100;
          const str = `\n${holder.wallet_address}\nAmount: ${parseFloat(
            holder.amount
          ).toFixed()} ${balancePercentage.toFixed(2)}%`;
          await bot.telegram.sendMessage(chatId, str); 
        }
        return;
      } else return;
    } catch (error) {
      console.error('Error fetching data:', error);
      retry++;
      if (retry === retryCount) {
        console.error('Max retry count reached');
      }
      
    }
    break;
    }
});
bot.launch();

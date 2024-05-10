'use strict';

import fetch from 'node-fetch';
import { Telegraf } from 'telegraf';
import { getTotalSupply } from './totalSupply.js'; //import function
import { ethers } from 'ethers';
import * as erc20Abi from "../abi/erc20Abi.json" assert { type: "json" };//json object
import { config as configureDotenv } from 'dotenv';
configureDotenv({ path: '../private/file.env' });
const key = process.env.CHAINBASE_KEY;
const token = process.env.T_HOLDER_BOT;
const httpEndPointUrl = process.env.BASE_HTTP_PROVIDER;
const bot = new Telegraf(token);
const chainId = 8453;
const customHttpProvider = new ethers.JsonRpcProvider(httpEndPointUrl);
export async function getTokenHolders(contractAddress, limit) {
  // Get token holders
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

let top10HoldersData = null;
(async function retrieveTop10Holders(
  tokenAddress = '0x4f2961458220a71ed4f84098cf8681d552AfB5C0'
) {
  const tokenContract = new ethers.Contract(
    tokenAddress,
    erc20Abi.default,
    customHttpProvider
  );
  const totalSupply = await getTotalSupply(tokenContract);
  // console.log(totalSupply);
  let retry = 0;
  const retryCount = 3;
  while (retry < retryCount) {
    try {
      const data = await getTokenHolders(tokenAddress, 50); //2 params, contract address && limit count || how many holders to get
      if (data && data.data) {
        top10HoldersData = data.data.map(holder => {
          const balancePercentage = (holder.amount / totalSupply) * 100;
          console.log(
            `${holder.wallet_address}, ${parseFloat(
              holder.amount
            ).toFixed()}, out of TS: ${balancePercentage.toFixed(2)}%`
          );
        });
        return;
      } else return;
    } catch (error) {
      console.error('Error fetching data:', error);
      retry++;
      if (retry === retryCount) {
        console.error('Max retry count reached');
      }
    }
  }
})();
// console.log(
//             `Amount: ${parseFloat(
//               holder.amount
//             ).toFixed()} Address: ${'https://basescan.org/address/' +
//               holder.wallet_address}`
//           );
// 'https://basescan.org/address/' +

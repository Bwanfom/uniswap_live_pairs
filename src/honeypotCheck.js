import { HoneypotIsV1 } from '@normalizex/honeypot-is';
import { Telegraf } from 'telegraf';
import { config as configureDotenv } from 'dotenv';

configureDotenv({ path: '../private/file.env' });
const token = process.env.HONEY_POT_DETECTOR;
const bot = new Telegraf(token);
const CHAIN_ID = 8453;
const honeypotis = new HoneypotIsV1();

bot.hears(/^\/scan (0x[0-9a-fA-F]{40})$/, async ctx => {
  const chatId = ctx.chat.id;
  const address = ctx.match[1];
  const PAIRS = await honeypotis.getPairs(address, CHAIN_ID);
  try {
    const req = await honeypotis.honeypotScan(
      address,
      PAIRS[0].Router,
      PAIRS[0].Pair,
      CHAIN_ID
    );
    const res = req;
    const str = `\nName: ${res.Token.Name}\nisHoneyPot: ${
      res.IsHoneypot == true
        ? res.IsHoneypot + '  🚩🚩🚩🚩 NOT SAFE, DON`T APE'
        : res.IsHoneypot + '  ✅✅ APE'
    }\nMax Buy: ${res.MaxBuy == null ? 'non' : res.MaxBuy}\nMax Sell: ${
      res.MaxSell == null ? 'non' : res.MaxSell
    }\nBuy Tax: ${res.BuyTax}\nSell Tax: ${res.SellTax}`;
    await bot.telegram.sendMessage(chatId, str);
  } catch (err) {
    console.error(err);
  }
});

bot.launch();

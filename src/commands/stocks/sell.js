const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const MarketManager = require('../../market/MarketManager');
const { sellShares } = require('../../market/trading');
const { logAudit } = require('../../utils/audit');
const { fmt } = require('../../utils/economy');

const run = async ({ userId, guildId, ticker, amount, reply }) => {
  if (!ticker || !amount || amount <= 0) {
    return reply({
      embeds: [embed.error('Usage: `/sell <ticker> <amount>`')],
      ephemeral: true,
    });
  }

  const t = ticker.toUpperCase();
  const stock = MarketManager.getStock(t);
  if (!stock) {
    return reply({
      embeds: [embed.error(`No stock found with ticker **${t}**. Use \`/stocks\` to see available stocks.`)],
      ephemeral: true,
    });
  }

  const shares = Math.floor(amount);
  const result = await sellShares(userId, guildId, t, shares);

  if (!result.ok) {
    return reply({ embeds: [embed.error(result.error)], ephemeral: true });
  }

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'stock_sell',
    amount: result.proceeds,
    currency: 'wallet',
    metadata: { ticker: t, shares, price: result.price },
  });

  const pnlText = result.profit >= 0 ? '+' : '';
  return reply({
    embeds: [
      embed.success(
        'Order Filled',
        `You sold **${shares}** share(s) of **${t}** at ${fmt(result.price)}.\nProceeds: ${fmt(result.proceeds)}\nProfit/Loss: ${pnlText}${fmt(result.profit)}.`,
      ),
    ],
  });
};

module.exports = {
  name: 'sell',
  description: 'Sell shares of a stock.',
  usage: '<ticker> <amount>',
  category: 'stocks',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell shares of a stock')
    .addStringOption((o) => o.setName('ticker').setDescription('Ticker symbol').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('Number of shares').setRequired(true).setMinValue(1)),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      ticker: args[0],
      amount: parseInt(args[1], 10),
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      ticker: interaction.options.getString('ticker'),
      amount: interaction.options.getInteger('amount'),
      reply: (data) => interaction.reply(data),
    });
  },
};

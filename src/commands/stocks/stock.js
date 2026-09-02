const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const StockHolding = require('../../models/StockHolding');
const MarketManager = require('../../market/MarketManager');
const { SECTOR_LABELS } = require('../../market/stocks');
const { getHistory } = require('../../market/priceHistory');
const { renderSingleStockChart } = require('../../market/chartRenderer');
const { fmt } = require('../../utils/economy');

const run = async ({ userId, guildId, ticker, reply }) => {
  if (!ticker) {
    return reply({
      embeds: [embed.error('Specify a ticker, e.g. `/stock RAQ`. Use `/stocks` to see them all.')],
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

  const price = MarketManager.getPrice(t);
  const prev = MarketManager.getPrevPrice(t);
  const change = prev ? ((price - prev) / prev) * 100 : 0;
  const supply = MarketManager.getSupply(t);
  const sector = SECTOR_LABELS[stock.sector] || stock.sector;

  const e = embed
    .economy(`📈 ${stock.name} (${t})`, stock.description)
    .addFields(
      { name: 'Sector', value: sector, inline: true },
      { name: 'Price', value: fmt(price), inline: true },
      { name: 'Change', value: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, inline: true },
      { name: 'Available Supply', value: supply.toLocaleString(), inline: true },
      { name: 'Volatility', value: `${(stock.volatility * 100).toFixed(1)}%`, inline: true },
    );

  // Show user's position in this stock
  const holding = await StockHolding.findOne({ userId, guildId, ticker: t });
  if (holding && (holding.shares || 0) > 0) {
    const costBasis = (holding.avgPrice || 0) * holding.shares;
    const value = price * holding.shares;
    const pnl = value - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    e.addFields({
      name: 'Your Position',
      value: `${holding.shares} share(s) @ ${fmt(holding.avgPrice)}\nValue: ${fmt(value)}\nP/L: ${pnl >= 0 ? '+' : ''}${fmt(pnl)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
    });
  } else {
    e.addFields({ name: 'Your Position', value: 'You hold no shares in this stock.' });
  }

  const history = await getHistory(t, 60);

  // Attach a chart when we have at least a couple of data points.
  if (history.length >= 2) {
    try {
      const buffer = await renderSingleStockChart(stock, history);
      const attachment = new AttachmentBuilder(buffer, { name: `${t}_chart.png` });
      e.setImage(`attachment://${t}_chart.png`);
      return reply({ embeds: [e], files: [attachment] });
    } catch {
      // fall back to text-only if rendering fails
    }
  }

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'stock',
  description: 'Show detailed info on a stock.',
  usage: '<ticker>',
  category: 'stocks',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Show details for a stock')
    .addStringOption((o) => o.setName('ticker').setDescription('Ticker symbol').setRequired(true)),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      ticker: args[0],
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      ticker: interaction.options.getString('ticker'),
      reply: (data) => interaction.reply(data),
    });
  },
};

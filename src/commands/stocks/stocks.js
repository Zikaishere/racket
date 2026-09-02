const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const MarketManager = require('../../market/MarketManager');
const { SECTOR_LABELS, STOCKS } = require('../../market/stocks');
const { getHistory } = require('../../market/priceHistory');
const { renderComparisonChart } = require('../../market/chartRenderer');
const { fmt } = require('../../utils/economy');

function changeArrow(change) {
  if (change > 0.01) return '📈';
  if (change < -0.01) return '📉';
  return '➖';
}

function formatLine(s) {
  const arrow = changeArrow(s.change);
  const sector = SECTOR_LABELS[s.sector] || s.sector;
  return `${arrow} **${s.ticker}** — ${fmt(s.price)} (${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%) · ${sector}`;
}

const run = async ({ reply }) => {
  const stocks = MarketManager.snapshot();

  let description = stocks.map(formatLine).join('\n');

  if (MarketManager.lastEvent) {
    const ev = MarketManager.lastEvent;
    const dir = ev.intensity >= 0 ? '▲' : '▼';
    description += `\n\n**Market Event:** ${ev.label} ${dir} — ${ev.description} (${ev.sectorLabel})`;
  }

  const e = embed
    .economy('📈 Stock Exchange', description)
    .setFooter({ text: 'Use /stock <ticker> for details · /buy and /sell to trade' });

  // Build a comparison chart from history for each stock (normalized % change).
  try {
    const all = [];
    for (const stock of STOCKS) {
      const hist = await getHistory(stock.ticker, 48);
      if (hist.length >= 2) all.push({ ticker: stock.ticker, sector: stock.sector, history: hist });
    }
    if (all.length >= 2) {
      const buffer = await renderComparisonChart(all);
      const attachment = new AttachmentBuilder(buffer, { name: 'market_comparison.png' });
      e.setImage('attachment://market_comparison.png');
      return reply({ embeds: [e], files: [attachment] });
    }
  } catch {
    // fall back to text-only
  }

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'stocks',
  aliases: ['market'],
  description: 'List all stocks and current prices.',
  usage: '',
  category: 'stocks',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('stocks').setDescription('List all stocks and current prices'),

  async execute({ message }) {
    return run({ reply: (data) => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({ reply: (data) => interaction.reply(data) });
  },
};

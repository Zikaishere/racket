const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUserPortfolio } = require('../../market/trading');
const { recordPortfolio, getPortfolioHistory } = require('../../market/portfolioHistory');
const { renderPortfolioChart } = require('../../market/chartRenderer');
const { fmt } = require('../../utils/economy');

const run = async ({ userId, guildId, isSelf, reply }) => {
  const { rows, invested, currentValue, pnl, pnlPercent } = await getUserPortfolio(userId, guildId);

  // Record a value snapshot for the owner's own history chart (throttled).
  if (isSelf) {
    await recordPortfolio(userId, guildId, currentValue).catch(() => {});
  }

  const e = embed.economy('📊 Portfolio', null).addFields(
    { name: 'Amount Invested', value: fmt(invested), inline: true },
    { name: 'Current Value', value: fmt(currentValue), inline: true },
    {
      name: 'Profit / Loss',
      value: `${pnl >= 0 ? '+' : ''}${fmt(pnl)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`,
      inline: true,
    },
  );

  if (!rows.length) {
    e.addFields({ name: 'Holdings', value: "You don't own any shares yet. Use `/buy` to invest." });
  } else {
    const lines = rows.map((r) => {
      const arrow = r.change > 0.01 ? '📈' : r.change < -0.01 ? '📉' : '➖';
      return `${arrow} **${r.ticker}** — ${r.shares} sh @ ${fmt(r.avgPrice)}\nValue ${fmt(r.value)} · P/L ${r.pnl >= 0 ? '+' : ''}${fmt(r.pnl)} (${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%)`;
    });
    e.addFields({ name: 'Holdings', value: lines.join('\n\n') });
  }

  // Attach a portfolio value chart for the owner when enough history exists.
  const history = await getPortfolioHistory(userId, guildId, 60);
  if (isSelf && history.length >= 2) {
    try {
      const buffer = await renderPortfolioChart(history);
      const attachment = new AttachmentBuilder(buffer, { name: 'portfolio_chart.png' });
      e.setImage('attachment://portfolio_chart.png');
      return reply({ embeds: [e], files: [attachment] });
    } catch {
      // fall back to text-only
    }
  }

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'portfolio',
  aliases: ['holdings'],
  description: 'View your stock portfolio and performance.',
  usage: '[user]',
  category: 'stocks',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('View your stock portfolio')
    .addUserOption((o) => o.setName('user').setDescription('User to inspect').setRequired(false)),

  async execute({ message }) {
    const target = message.mentions.users.first();
    return run({
      userId: target ? target.id : message.author.id,
      guildId: message.guild.id,
      isSelf: !target,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    const target = interaction.options.getUser('user');
    return run({
      userId: target ? target.id : interaction.user.id,
      guildId: interaction.guild.id,
      isSelf: !target,
      reply: (data) => interaction.reply(data),
    });
  },
};

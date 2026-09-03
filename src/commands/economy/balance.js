const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { getUserPortfolio } = require('../../market/trading');

// Future hook: sum of the user's business values. Returns 0 until Businesses exist.
async function getBusinessValue(_userId, _guildId) {
  return 0;
}

const run = async ({ userId, guildId, targetUser, _client, reply }) => {
  const user = await getUser(userId, guildId);
  const name = targetUser ? `${targetUser.username}'s` : 'Your';

  const wallet = user.wallet || 0;
  const bank = user.bank || 0;

  const portfolio = await getUserPortfolio(userId, guildId);
  const stocksValue = portfolio.currentValue || 0;
  const stockPnl = portfolio.pnl || 0;
  const stockPnlText = portfolio.invested > 0
    ? ` (${stockPnl >= 0 ? '+' : ''}${fmt(stockPnl)})`
    : '';

  const businessValue = await getBusinessValue(userId, guildId);
  const netWorth = wallet + bank + stocksValue + businessValue;

  const e = embed
    .economy(`Balance: ${name} Summary`, null)
    .addFields(
      { name: 'Wallet', value: fmt(wallet), inline: true },
      { name: 'Bank', value: fmt(bank), inline: true },
      {
        name: 'Stocks',
        value: portfolio.invested > 0 ? `${fmt(stocksValue)}${stockPnlText}` : fmt(0),
        inline: true,
      },
      { name: 'Business', value: fmt(businessValue), inline: true },
      { name: '💎 Net Worth', value: fmt(netWorth), inline: true },
      { name: 'Total Earned', value: fmt(user.totalEarned), inline: true },
    );

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'balance',
  aliases: ['bal', 'wallet'],
  description: "Check your or someone else's balance summary.",
  usage: '[user]',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('balance')
    .setDescription("Check your or someone else's balance summary")
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(false)),

  async execute({ message, _args, client }) {
    const target = message.mentions.users.first();
    const userId = target ? target.id : message.author.id;
    return run({ userId, guildId: message.guild.id, targetUser: target, client, reply: (d) => message.reply(d) });
  },

  async executeSlash({ interaction }) {
    const target = interaction.options.getUser('user');
    const userId = target ? target.id : interaction.user.id;
    return run({ userId, guildId: interaction.guild.id, targetUser: target, reply: (d) => interaction.reply(d) });
  },
};

const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const User = require('../../models/User');
const { fmt } = require('../../utils/economy');

const TYPES = {
  balance: { field: null, label: 'Net Worth Leaderboard' }, // net worth (custom calc)
  earned: { field: 'totalEarned', label: 'All-Time Earners' },
  wagered: { field: 'stats.totalWagered', label: 'Top Gamblers' },
  heists: { field: 'stats.heistsWon', label: 'Top Heist Leaders' },
};

function getNetWorth(user) {
  return (user.wallet || 0) + (user.bank || 0); // add + user.chips if you want casino included
}

function getValue(user, type) {
  if (type === 'earned') return fmt(user.totalEarned || 0);
  if (type === 'wagered') return fmt(user.stats?.totalWagered || 0);
  if (type === 'heists') return `${user.stats?.heistsWon || 0} wins`;

  return fmt(getNetWorth(user));
}

const run = async ({ guildId, type, reply }) => {
  const typeKey = TYPES[type] ? type : 'balance';
  const typeData = TYPES[typeKey];

  let users;

  if (typeKey === 'balance') {
    users = await User.aggregate([
      { $match: { guildId } },
      { $addFields: { netWorth: { $add: ['$wallet', '$bank'] } } },
      { $sort: { netWorth: -1 } },
      { $limit: 10 },
    ]);
    users = users.map((u) => ({ ...u, userId: u.userId }));
  } else if (typeKey === 'earned') {
    users = await User.find({ guildId }).sort({ totalEarned: -1 }).limit(10).lean();
  } else if (typeKey === 'wagered') {
    users = await User.find({ guildId }).sort({ 'stats.totalWagered': -1 }).limit(10).lean();
  } else if (typeKey === 'heists') {
    users = await User.find({ guildId }).sort({ 'stats.heistsWon': -1 }).limit(10).lean();
  } else {
    users = [];
  }

  if (!users.length) {
    return reply({
      embeds: [embed.info('Leaderboard', 'No data yet!')],
      ephemeral: true,
    });
  }

  const lines = users.map((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;

    return `${medal} <@${user.userId}> - ${getValue(user, typeKey)}`;
  });

  return reply({
    embeds: [embed.economy(`🏆 ${typeData.label}`, lines.join('\n'))],
  });
};

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top', 'richest'],
  description: 'View the server leaderboard, or use earned, wagered, or heists for alternate rankings.',
  usage: '[earned|wagered|heists]',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboard')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Optional leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: 'Balance', value: 'balance' },
          { name: 'All-Time Earned', value: 'earned' },
          { name: 'Total Wagered', value: 'wagered' },
          { name: 'Heists Won', value: 'heists' },
        ),
    ),

  async execute({ message, args }) {
    const type = args[0]?.toLowerCase() || 'balance';

    if (!TYPES[type]) {
      return message.reply({
        embeds: [embed.error('Usage: `.leaderboard [earned|wagered|heists]`')],
      });
    }

    return run({
      guildId: message.guild.id,
      type,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      guildId: interaction.guild.id,
      type: interaction.options.getString('type') || 'balance',
      reply: (data) => interaction.reply(data),
    });
  },
};

const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const User = require('../../models/User');
const { fmt } = require('../../utils/economy');

const TYPES = {
  balance: { field: 'balance', label: 'Server Leaderboard' },
  earned: { field: 'totalEarned', label: 'All-Time Earners' },
  wagered: { field: 'stats.totalWagered', label: 'Top Gamblers' },
  heists: { field: 'stats.heistsWon', label: 'Top Heist Leaders' },
};

function getValue(user, type) {
  if (type === 'earned') return fmt(user.totalEarned || 0);
  if (type === 'wagered') return fmt(user.stats?.totalWagered || 0);
  if (type === 'heists') return `${user.stats?.heistsWon || 0} wins`;
  return fmt(user.balance || 0);
}

const run = async ({ guildId, type, reply }) => {
  const typeKey = TYPES[type] ? type : 'balance';
  const typeData = TYPES[typeKey];
  const users = await User.find({ guildId }).sort({ [typeData.field]: -1 }).limit(10);

  if (!users.length) {
    return reply({ embeds: [embed.info('Leaderboard', 'No data yet!')], ephemeral: true });
  }

  const lines = users.map((user, index) => {
    const medal = index === 0 ? '??' : index === 1 ? '??' : index === 2 ? '??' : `**${index + 1}.**`;
    return `${medal} <@${user.userId}> - ${getValue(user, typeKey)}`;
  });

  return reply({
    embeds: [embed.economy(`?? ${typeData.label}`, lines.join('\n'))],
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
    .addStringOption(option => option.setName('type').setDescription('Optional leaderboard type').setRequired(false).addChoices(
      { name: 'Balance', value: 'balance' },
      { name: 'All-Time Earned', value: 'earned' },
      { name: 'Total Wagered', value: 'wagered' },
      { name: 'Heists Won', value: 'heists' }
    )),

  async execute({ message, args }) {
    const type = args[0]?.toLowerCase() || 'balance';
    if (!TYPES[type]) {
      return message.reply({ embeds: [embed.error('Usage: `.leaderboard [earned|wagered|heists]`')] });
    }
    return run({ guildId: message.guild.id, type, reply: (data) => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({ guildId: interaction.guild.id, type: interaction.options.getString('type') || 'balance', reply: (data) => interaction.reply(data) });
  },
};

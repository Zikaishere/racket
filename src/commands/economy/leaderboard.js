const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const User = require('../../models/User');
const { fmt } = require('../../utils/economy');

const TYPES = {
  balance:  { field: 'balance',             label: '💰 Richest Members' },
  earned:   { field: 'totalEarned',         label: '📈 All-Time Earners' },
  wagered:  { field: 'stats.totalWagered',  label: '🎲 Top Gamblers' },
  heists:   { field: 'stats.heistsWon',     label: '🔫 Top Heist Leaders' },
};

const run = async ({ guildId, type, reply }) => {
  const typeData = TYPES[type] || TYPES.balance;
  const users = await User.find({ guildId }).sort({ [typeData.field]: -1 }).limit(10);

  if (!users.length) return reply({ embeds: [embed.info('🏆 Leaderboard', 'No data yet!')], ephemeral: true });

  const lines = users.map((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
    const value = type === 'heists' ? `${u.stats.heistsWon} wins` : fmt(u[typeData.field] ?? u.stats?.[typeData.field.split('.')[1]] ?? 0);
    return `${medal} <@${u.userId}> — ${value}`;
  });

  const e = embed.economy(`🏆 ${typeData.label}`, lines.join('\n'));
  return reply({ embeds: [e] });
};

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top', 'richest'],
  description: 'View the server leaderboard.',
  usage: '[balance|earned|wagered|heists]',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboard')
    .addStringOption(o => o.setName('type')
      .setDescription('Leaderboard type')
      .setRequired(false)
      .addChoices(
        { name: 'Balance', value: 'balance' },
        { name: 'All-Time Earned', value: 'earned' },
        { name: 'Total Wagered', value: 'wagered' },
        { name: 'Heists Won', value: 'heists' },
      )),

  async execute({ message, args }) {
    return run({ guildId: message.guild.id, type: args[0] || 'balance', reply: (d) => message.reply(d) });
  },

  async executeSlash({ interaction }) {
    return run({ guildId: interaction.guild.id, type: interaction.options.getString('type') || 'balance', reply: (d) => interaction.reply(d) });
  }
};
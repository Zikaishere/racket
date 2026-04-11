const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { DAILY_COOLDOWN, WORK_COOLDOWN, ROB_COOLDOWN } = require('../../config');

function formatRemaining(targetDate, cooldown) {
  const last = targetDate ? new Date(targetDate).getTime() : 0;
  const remaining = cooldown - (Date.now() - last);
  if (remaining <= 0) return 'Ready';

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.ceil((remaining % 60000) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getLuckLabel(luck) {
  if (luck > 1) return 'Hot Streak';
  if (luck < 1) return 'On Tilt';
  return 'Normal';
}

function formatDuration(ms) {
  if (ms <= 0) return 'Clear';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.ceil((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const run = async ({ userId, guildId, targetUser, reply }) => {
  const user = await getUser(userId, guildId);
  const titleName = targetUser ? `${targetUser.username}'s` : 'Your';
  const winRate =
    user.stats.gamesPlayed > 0 ? `${((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(1)}%` : 'N/A';
  const wantedRemaining = user.wantedUntil ? Math.max(0, new Date(user.wantedUntil).getTime() - Date.now()) : 0;

  const e = embed.economy(`Profile: ${titleName} Empire`, null).addFields(
    { name: 'Wallet', value: fmt(user.balance), inline: true },
    { name: 'Bank', value: fmt(user.bank), inline: true },
    { name: 'Chips', value: `**${user.chips.toLocaleString()}**`, inline: true },
    { name: 'Rank', value: user.casinoRank, inline: true },
    { name: 'Luck', value: `${getLuckLabel(user.luck)} (x${user.luck.toFixed(2)})`, inline: true },
    { name: 'Streak', value: `${user.stats.currentStreak}`, inline: true },
    { name: 'Games', value: `${user.stats.gamesWon}/${user.stats.gamesPlayed} won`, inline: true },
    { name: 'Win Rate', value: winRate, inline: true },
    { name: 'Total Wagered', value: fmt(user.stats.totalWagered), inline: true },
    { name: 'Heists', value: `${user.stats.heistsWon} wins / ${user.stats.heistsJoined} joined`, inline: true },
    { name: 'Black Market Sales', value: `${user.stats.blackmarketSales}`, inline: true },
    {
      name: 'Inventory Items',
      value: `${user.inventory.reduce((sum, item) => sum + item.quantity, 0)}`,
      inline: true,
    },
    { name: 'Wanted', value: formatDuration(wantedRemaining), inline: true },
    {
      name: 'Heist Cooldown',
      value: formatDuration(
        user.heistCooldownUntil ? Math.max(0, new Date(user.heistCooldownUntil).getTime() - Date.now()) : 0,
      ),
      inline: true,
    },
    { name: 'Daily', value: formatRemaining(user.lastDaily, DAILY_COOLDOWN), inline: true },
    { name: 'Work', value: formatRemaining(user.lastWork, WORK_COOLDOWN), inline: true },
    { name: 'Rob', value: formatRemaining(user.lastRob, ROB_COOLDOWN), inline: true },
  );

  if (user.moderation?.frozen) {
    e.addFields({
      name: 'Account Status',
      value: `Frozen${user.moderation.freezeReason ? `\nReason: ${user.moderation.freezeReason}` : ''}`,
    });
  }

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'profile',
  aliases: ['status', 'stats', 'me'],
  description: 'View your full player profile, cooldowns, and progression.',
  usage: '[user]',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your player profile')
    .addUserOption((o) => o.setName('user').setDescription('User to inspect').setRequired(false)),

  async execute({ message }) {
    const target = message.mentions.users.first();
    const userId = target ? target.id : message.author.id;
    return run({ userId, guildId: message.guild.id, targetUser: target, reply: (d) => message.reply(d) });
  },

  async executeSlash({ interaction }) {
    const target = interaction.options.getUser('user');
    const userId = target ? target.id : interaction.user.id;
    return run({ userId, guildId: interaction.guild.id, targetUser: target, reply: (d) => interaction.reply(d) });
  },
};

const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const User = require('../../models/User');
const { fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { DAILY_AMOUNT, DAILY_COOLDOWN } = require('../../config');

const run = async ({ userId, guildId, reply }) => {
  await User.findOrCreate(userId, guildId);

  const updated = await User.findOneAndUpdate(
    {
      userId,
      guildId,
      $or: [
        { lastDaily: null },
        { lastDaily: { $lte: new Date(Date.now() - DAILY_COOLDOWN) } },
      ],
    },
    {
      $set: { lastDaily: new Date() },
      $inc: { balance: DAILY_AMOUNT, totalEarned: DAILY_AMOUNT },
    },
    { new: true }
  );

  if (!updated) {
    const user = await User.findOrCreate(userId, guildId);
    const last = user.lastDaily ? new Date(user.lastDaily).getTime() : 0;
    const remaining = DAILY_COOLDOWN - (Date.now() - last);
    const hours = Math.ceil(remaining / 3600000);
    const mins = Math.ceil((remaining % 3600000) / 60000);
    return reply({ embeds: [embed.warning('Daily Already Claimed', `You already claimed your daily. Come back in **${hours}h ${mins}m**.`)], ephemeral: true });
  }

  await logAudit({ guildId, actorId: userId, targetId: userId, action: 'daily_claim', amount: DAILY_AMOUNT, currency: 'wallet' });
  return reply({ embeds: [embed.success('Daily Reward', `You claimed your daily reward of ${fmt(DAILY_AMOUNT)}.\n\nNew balance: ${fmt(updated.balance)}`)] });
};

module.exports = {
  name: 'daily',
  aliases: ['claim'],
  description: 'Claim your daily reward.',
  usage: '',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward'),

  async execute({ message }) {
    return run({ userId: message.author.id, guildId: message.guild.id, reply: data => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({ userId: interaction.user.id, guildId: interaction.guild.id, reply: data => interaction.reply(data) });
  },
};
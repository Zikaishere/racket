const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { ROB_COOLDOWN, ROB_SUCCESS_RATE, ROB_FINE_PERCENT, ROB_MIN_BAL } = require('../../config');

const run = async ({ userId, guildId, targetUser, reply }) => {
  if (!targetUser) return reply({ embeds: [embed.error('Please mention a user to rob.')], ephemeral: true });
  if (targetUser.id === userId) return reply({ embeds: [embed.error('You cannot rob yourself.')], ephemeral: true });
  if (targetUser.bot) return reply({ embeds: [embed.error('You cannot rob bots.')], ephemeral: true });

  const attacker = await getUser(userId, guildId);
  const last = attacker.lastRob ? new Date(attacker.lastRob).getTime() : 0;
  const remaining = ROB_COOLDOWN - (Date.now() - last);

  if (remaining > 0) {
    const hours = Math.floor(remaining / 3600000);
    const mins = Math.ceil((remaining % 3600000) / 60000);
    return reply({
      embeds: [
        embed.warning('Lay Low', `The cops are still looking for you. You can rob again in **${hours}h ${mins}m**.`),
      ],
    });
  }

  const victim = await getUser(targetUser.id, guildId);
  if (victim.wallet < ROB_MIN_BAL) {
    return reply({
      embeds: [embed.error(`${targetUser.username} is too poor to rob. They need at least ${fmt(ROB_MIN_BAL)}.`)],
    });
  }

  attacker.lastRob = new Date();
  const success = Math.random() < ROB_SUCCESS_RATE;

  if (success) {
    const percentage = 0.05 + Math.random() * 0.15;
    const stolen = Math.max(1, Math.floor(victim.wallet * percentage));

    victim.wallet -= stolen;
    attacker.wallet += stolen;
    attacker.totalEarned += stolen;
    await victim.save();
    await attacker.save();

    await logAudit({
      guildId,
      actorId: userId,
      targetId: targetUser.id,
      action: 'robbery_success',
      amount: stolen,
      currency: 'wallet',
    });
    return reply({
      embeds: [
        embed.success('Robbery Successful', `You managed to steal ${fmt(stolen)} from **${targetUser.username}**.`),
      ],
    });
  }

  const fine = Math.floor(victim.wallet * ROB_FINE_PERCENT);
  const actualFine = Math.min(attacker.wallet, fine);
  attacker.wallet -= actualFine;
  victim.wallet += actualFine;
  await victim.save();
  await attacker.save();

  await logAudit({
    guildId,
    actorId: userId,
    targetId: targetUser.id,
    action: 'robbery_failed',
    amount: actualFine,
    currency: 'wallet',
  });
  const message =
    actualFine > 0
      ? `You got caught and had to pay **${targetUser.username}** a fine of ${fmt(actualFine)}.`
      : 'You got caught, but you were broke, so you got away with a warning.';

  return reply({ embeds: [embed.error(message)] });
};

module.exports = {
  name: 'rob',
  aliases: ['steal'],
  description: 'Try to rob raqs from another user.',
  usage: '<@user>',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Try to rob raqs from another user')
    .addUserOption((o) => o.setName('user').setDescription('User to rob').setRequired(true)),

  async execute({ message }) {
    const target = message.mentions.users.first();
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      targetUser: target,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    const target = interaction.options.getUser('user');
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      targetUser: target,
      reply: (data) => interaction.reply(data),
    });
  },
};

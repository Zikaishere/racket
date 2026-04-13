const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { deposit, getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');

const run = async ({ userId, guildId, rawAmount, reply }) => {
  const user = await getUser(userId, guildId);
  const normalized = String(rawAmount).toLowerCase();
  const amount = normalized === 'all' || normalized === 'max' ? user.wallet : parseInt(rawAmount, 10);

  if (isNaN(amount) || amount <= 0) {
    return reply({ embeds: [embed.error('Please specify a valid amount to deposit.')], ephemeral: true });
  }

  const success = await deposit(userId, guildId, amount);
  if (!success) {
    return reply({ embeds: [embed.error("You don't have enough raqs in your wallet.")], ephemeral: true });
  }

  const updated = await getUser(userId, guildId);
  await logAudit({ guildId, actorId: userId, targetId: userId, action: 'bank_deposit', amount, currency: 'wallet' });
  return reply({
    embeds: [
      embed.success(
        'Deposit Successful',
        `You deposited ${fmt(amount)} into your bank.\n\n**Wallet:** ${fmt(updated.wallet)}\n**Bank:** ${fmt(updated.bank)}`,
      ),
    ],
  });
};

module.exports = {
  name: 'deposit',
  aliases: ['dep'],
  description: 'Deposit raqs into your bank account.',
  usage: '<amount|all>',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit raqs into your bank account')
    .addStringOption((o) => o.setName('amount').setDescription('Amount or "all"').setRequired(true)),

  async execute({ message, args }) {
    if (!args[0]) return message.reply({ embeds: [embed.error('Usage: `.deposit <amount|all>`')] });
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      rawAmount: args[0],
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      rawAmount: interaction.options.getString('amount'),
      reply: (data) => interaction.reply(data),
    });
  },
};

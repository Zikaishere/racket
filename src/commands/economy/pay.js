const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { transfer, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');

const run = async ({ fromId, toId, toUser, guildId, amount, reply }) => {
  if (fromId === toId) return reply({ embeds: [embed.error('You cannot pay yourself.')], ephemeral: true });
  if (isNaN(amount) || amount <= 0) return reply({ embeds: [embed.error('Please enter a valid amount.')], ephemeral: true });

  const success = await transfer(fromId, toId, guildId, amount);
  if (!success) return reply({ embeds: [embed.error('You do not have enough raqs.')], ephemeral: true });

  await logAudit({ guildId, actorId: fromId, targetId: toId, action: 'economy_pay', amount, currency: 'wallet' });
  return reply({ embeds: [embed.success('Payment Sent', `You sent ${fmt(amount)} to **${toUser.username}**.`)] });
};

module.exports = {
  name: 'pay',
  aliases: ['give', 'transfer'],
  description: 'Pay another user some raqs.',
  usage: '<user> <amount>',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Pay another user some raqs')
    .addUserOption(o => o.setName('user').setDescription('User to pay').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to pay').setRequired(true).setMinValue(1)),

  async execute({ message, args }) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1], 10);
    if (!target) return message.reply({ embeds: [embed.error('Please mention a user to pay.')] });
    return run({ fromId: message.author.id, toId: target.id, toUser: target, guildId: message.guild.id, amount, reply: data => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    return run({ fromId: interaction.user.id, toId: target.id, toUser: target, guildId: interaction.guild.id, amount, reply: data => interaction.reply(data) });
  },
};
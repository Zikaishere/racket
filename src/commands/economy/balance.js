const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');

const run = async ({ userId, guildId, targetUser, client, reply }) => {
  const user = await getUser(userId, guildId);
  const name = targetUser ? `${targetUser.username}'s` : 'Your';

  const e = embed
    .economy(`💰 ${name} Balance`, null)
    .addFields(
      { name: '👛 Wallet', value: fmt(user.balance), inline: true },
      { name: '🏦 Bank', value: fmt(user.bank), inline: true },
      { name: '📈 Total Earned', value: fmt(user.totalEarned), inline: true },
    );

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'balance',
  aliases: ['bal', 'wallet'],
  description: "Check your or someone else's balance.",
  usage: '[user]',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('balance')
    .setDescription("Check your or someone else's balance")
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(false)),

  async execute({ message, args, client }) {
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

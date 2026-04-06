const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleSetField } = require('../../utils/adminTools');

module.exports = {
  name: 'setbalance',
  aliases: [],
  description: 'Set a user\'s wallet balance.',
  usage: '<@user> <amount>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('setbalance')
    .setDescription('Set a user\'s wallet balance')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Wallet amount').setRequired(true).setMinValue(0)),

  async execute({ message, args }) {
    const target = parseMentionTarget(message);
    const amount = parseInt(args[1], 10);
    if (!target || Number.isNaN(amount)) {
      return message.reply({ embeds: [embed.error('Usage: `.setbalance @user <amount>`')] });
    }
    return message.reply({ embeds: [await handleSetField(message.guild.id, message.author.id, target, 'balance', amount)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({ embeds: [await handleSetField(interaction.guild.id, interaction.user.id, interaction.options.getUser('user'), 'balance', interaction.options.getInteger('amount'))], ephemeral: true });
  },
};

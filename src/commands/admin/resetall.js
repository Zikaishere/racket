const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleResetAll } = require('../../utils/adminTools');

module.exports = {
  name: 'resetall',
  aliases: [],
  description: 'Reset every user\'s wallet, bank, and chips in this server.',
  usage: '',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('resetall')
    .setDescription('Reset every user\'s wallet, bank, and chips in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message }) {
    return message.reply({ embeds: [await handleResetAll(message.guild.id, message.author.id)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({ embeds: [await handleResetAll(interaction.guild.id, interaction.user.id)], ephemeral: true });
  },
};

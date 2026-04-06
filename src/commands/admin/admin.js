const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildAdminOverviewEmbed } = require('../../utils/adminTools');

module.exports = {
  name: 'admin',
  aliases: ['adm'],
  description: 'Show the standalone admin commands available in this server.',
  usage: '',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('View the standalone admin commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message, prefix }) {
    return message.reply({ embeds: [buildAdminOverviewEmbed(prefix)] });
  },

  async executeSlash({ interaction, guildData }) {
    const prefix = guildData?.prefix || '.';
    return interaction.reply({ embeds: [buildAdminOverviewEmbed(prefix)], ephemeral: true });
  },
};

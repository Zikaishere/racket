const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildStatusEmbed, getGuildConfig } = require('../../utils/configTools');

module.exports = {
  name: 'configstatus',
  aliases: ['cfgstatus'],
  description: 'View the current bot configuration for this server.',
  usage: '',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('configstatus')
    .setDescription('View the current bot configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message, guildData }) {
    const currentGuildData = guildData || (await getGuildConfig(message.guild.id));
    return message.reply({ embeds: [buildStatusEmbed(currentGuildData)] });
  },

  async executeSlash({ interaction, guildData }) {
    const currentGuildData = guildData || (await getGuildConfig(interaction.guild.id));
    return interaction.reply({ embeds: [buildStatusEmbed(currentGuildData)], ephemeral: true });
  },
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { DEFAULT_PREFIX } = require('../../config');
const { buildSetupEmbed } = require('../../utils/setupMessage');
const { getGuildConfig } = require('../../utils/configTools');

module.exports = {
  name: 'configsetup',
  aliases: ['setupguide'],
  description: 'Show the setup guide for this server.',
  usage: '',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('configsetup')
    .setDescription('Show the setup guide for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message, prefix, guildData }) {
    const currentGuildData = guildData || await getGuildConfig(message.guild.id);
    return message.reply({ embeds: [buildSetupEmbed(prefix || currentGuildData.prefix || DEFAULT_PREFIX)] });
  },

  async executeSlash({ interaction, guildData }) {
    const currentGuildData = guildData || await getGuildConfig(interaction.guild.id);
    return interaction.reply({ embeds: [buildSetupEmbed(currentGuildData.prefix || DEFAULT_PREFIX)], ephemeral: true });
  },
};

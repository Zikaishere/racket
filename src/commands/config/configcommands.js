const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { CONFIG_CATEGORY_CHOICES, buildCommandsEmbed, getGuildConfig } = require('../../utils/configTools');

module.exports = {
  name: 'configcommands',
  aliases: ['cfgcommands'],
  description: 'List the commands that can be toggled in this server.',
  usage: '[category]',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('configcommands')
    .setDescription('List the commands that can be toggled')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option.setName('category').setDescription('Optional category filter').setRequired(false).addChoices(...CONFIG_CATEGORY_CHOICES)),

  async execute({ message, args, client, guildData }) {
    const category = args[0]?.toLowerCase() || 'all';
    if (!CONFIG_CATEGORY_CHOICES.some(choice => choice.value === category)) {
      return message.reply({ embeds: [embed.error('Usage: `.configcommands [all|economy|casino|heist|blackmarket|info|admin|config]`')] });
    }
    const currentGuildData = guildData || await getGuildConfig(message.guild.id);
    return message.reply({ embeds: [buildCommandsEmbed(client, currentGuildData, category)] });
  },

  async executeSlash({ interaction, client, guildData }) {
    const currentGuildData = guildData || await getGuildConfig(interaction.guild.id);
    return interaction.reply({ embeds: [buildCommandsEmbed(client, currentGuildData, interaction.options.getString('category') || 'all')], ephemeral: true });
  },
};

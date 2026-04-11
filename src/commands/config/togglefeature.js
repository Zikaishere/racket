const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { FEATURE_CHOICES, setFeature } = require('../../utils/configTools');

module.exports = {
  name: 'togglefeature',
  aliases: ['featuretoggle'],
  description: 'Enable or disable a full feature in this server.',
  usage: '<casino|heist|blackmarket> <on|off>',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('togglefeature')
    .setDescription('Enable or disable a full feature')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Feature name')
        .setRequired(true)
        .addChoices(...FEATURE_CHOICES),
    )
    .addBooleanOption((option) =>
      option.setName('enabled').setDescription('Whether the feature should be enabled').setRequired(true),
    ),

  async execute({ message, args }) {
    const featureName = args[0]?.toLowerCase();
    const state = args[1]?.toLowerCase();
    if (
      !['casino', 'heist', 'blackmarket'].includes(featureName) ||
      !['on', 'off', 'true', 'false', 'enable', 'disable'].includes(state)
    ) {
      return message.reply({ embeds: [embed.error('Usage: `.togglefeature <casino|heist|blackmarket> <on|off>`')] });
    }
    return message.reply({
      embeds: [
        await setFeature(message.guild.id, message.author.id, featureName, ['on', 'true', 'enable'].includes(state)),
      ],
    });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [
        await setFeature(
          interaction.guild.id,
          interaction.user.id,
          interaction.options.getString('name'),
          interaction.options.getBoolean('enabled'),
        ),
      ],
      ephemeral: true,
    });
  },
};

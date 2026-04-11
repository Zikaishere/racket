const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { setCommandState } = require('../../utils/configTools');

module.exports = {
  name: 'togglecommand',
  aliases: ['commandtoggle'],
  description: 'Enable or disable an individual command in this server.',
  usage: '<command> <on|off>',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('togglecommand')
    .setDescription('Enable or disable an individual command')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('name').setDescription('Command or alias').setRequired(true))
    .addBooleanOption((option) =>
      option.setName('enabled').setDescription('Whether the command should be enabled').setRequired(true),
    ),

  async execute({ message, args, client }) {
    const commandName = args[0];
    const state = args[1]?.toLowerCase();
    if (!commandName || !['on', 'off', 'true', 'false', 'enable', 'disable'].includes(state)) {
      return message.reply({ embeds: [embed.error('Usage: `.togglecommand <command> <on|off>`')] });
    }
    return message.reply({
      embeds: [
        await setCommandState(
          message.guild.id,
          message.author.id,
          client,
          commandName,
          ['on', 'true', 'enable'].includes(state),
        ),
      ],
    });
  },

  async executeSlash({ interaction, client }) {
    return interaction.reply({
      embeds: [
        await setCommandState(
          interaction.guild.id,
          interaction.user.id,
          client,
          interaction.options.getString('name'),
          interaction.options.getBoolean('enabled'),
        ),
      ],
      ephemeral: true,
    });
  },
};

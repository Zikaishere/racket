const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { setPrefix } = require('../../utils/configTools');

module.exports = {
  name: 'setprefix',
  aliases: ['prefixset'],
  description: 'Change the bot prefix for this server.',
  usage: '<newPrefix>',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Change the bot prefix for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('value').setDescription('New prefix').setRequired(true)),

  async execute({ message, args }) {
    const newPrefix = args[0];
    if (!newPrefix || newPrefix.length > 5) {
      return message.reply({
        embeds: [embed.error('Usage: `.setprefix <newPrefix>` and the prefix must be 1-5 characters.')],
      });
    }
    return message.reply({ embeds: [await setPrefix(message.guild.id, message.author.id, newPrefix)] });
  },

  async executeSlash({ interaction }) {
    const value = interaction.options.getString('value');
    if (!value || value.length > 5) {
      return interaction.reply({ embeds: [embed.error('The prefix must be 1-5 characters.')], ephemeral: true });
    }
    return interaction.reply({
      embeds: [await setPrefix(interaction.guild.id, interaction.user.id, value)],
      ephemeral: true,
    });
  },
};

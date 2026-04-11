const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildAuditEmbed } = require('../../utils/adminTools');

module.exports = {
  name: 'auditlog',
  aliases: ['audit'],
  description: 'View recent audit entries for this server.',
  usage: '[count]',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('auditlog')
    .setDescription('View recent audit entries for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('How many entries to show')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    ),

  async execute({ message, args }) {
    return message.reply({ embeds: [await buildAuditEmbed(message.guild.id, parseInt(args[0], 10) || 5)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [await buildAuditEmbed(interaction.guild.id, interaction.options.getInteger('count') || 5)],
      ephemeral: true,
    });
  },
};

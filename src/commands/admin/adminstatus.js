const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, buildStatusEmbed } = require('../../utils/adminTools');

module.exports = {
  name: 'adminstatus',
  aliases: ['astatus'],
  description: "Inspect a user's economy and moderation state.",
  usage: '<@user>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('adminstatus')
    .setDescription("Inspect a user's account state")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true)),

  async execute({ message }) {
    const target = parseMentionTarget(message);
    if (!target) {
      return message.reply({ embeds: [embed.error('Usage: `.adminstatus @user`')] });
    }
    return message.reply({ embeds: [await buildStatusEmbed(message.guild.id, target)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [await buildStatusEmbed(interaction.guild.id, interaction.options.getUser('user'))],
      ephemeral: true,
    });
  },
};

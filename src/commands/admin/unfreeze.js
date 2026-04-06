const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleUnfreeze } = require('../../utils/adminTools');

module.exports = {
  name: 'unfreeze',
  aliases: [],
  description: 'Remove a user\'s freeze status.',
  usage: '<@user>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('unfreeze')
    .setDescription('Remove a user\'s freeze status')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)),

  async execute({ message }) {
    const target = parseMentionTarget(message);
    if (!target) {
      return message.reply({ embeds: [embed.error('Usage: `.unfreeze @user`')] });
    }
    return message.reply({ embeds: [await handleUnfreeze(message.guild.id, message.author.id, target)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({ embeds: [await handleUnfreeze(interaction.guild.id, interaction.user.id, interaction.options.getUser('user'))], ephemeral: true });
  },
};

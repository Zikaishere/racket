const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleReset } = require('../../utils/adminTools');

module.exports = {
  name: 'resetuser',
  aliases: ['userreset'],
  description: 'Reset one user\'s wallet, bank, and chips.',
  usage: '<@user>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('resetuser')
    .setDescription('Reset one user\'s wallet, bank, and chips')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)),

  async execute({ message }) {
    const target = parseMentionTarget(message);
    if (!target) {
      return message.reply({ embeds: [embed.error('Usage: `.resetuser @user`')] });
    }
    return message.reply({ embeds: [await handleReset(message.guild.id, message.author.id, target)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({ embeds: [await handleReset(interaction.guild.id, interaction.user.id, interaction.options.getUser('user'))], ephemeral: true });
  },
};

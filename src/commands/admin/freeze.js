const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleFreeze } = require('../../utils/adminTools');

module.exports = {
  name: 'freeze',
  aliases: [],
  description: 'Freeze a user from economy and game usage.',
  usage: '<@user> [reason]',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('freeze')
    .setDescription('Freeze a user from economy and game usage')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Why the user is being frozen').setRequired(false)),

  async execute({ message, args }) {
    const target = parseMentionTarget(message);
    if (!target) {
      return message.reply({ embeds: [embed.error('Usage: `.freeze @user [reason]`')] });
    }
    const reason = args.slice(1).join(' ').trim();
    return message.reply({ embeds: [await handleFreeze(message.guild.id, message.author.id, target, reason)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({ embeds: [await handleFreeze(interaction.guild.id, interaction.user.id, interaction.options.getUser('user'), interaction.options.getString('reason'))], ephemeral: true });
  },
};

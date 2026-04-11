const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleSetField } = require('../../utils/adminTools');

module.exports = {
  name: 'setchips',
  aliases: [],
  description: "Set a user's chip balance.",
  usage: '<@user> <amount>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('setchips')
    .setDescription("Set a user's chip balance")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption((option) =>
      option.setName('amount').setDescription('Chip amount').setRequired(true).setMinValue(0),
    ),

  async execute({ message, args }) {
    const target = parseMentionTarget(message);
    const amount = parseInt(args[1], 10);
    if (!target || Number.isNaN(amount)) {
      return message.reply({ embeds: [embed.error('Usage: `.setchips @user <amount>`')] });
    }
    return message.reply({
      embeds: [await handleSetField(message.guild.id, message.author.id, target, 'chips', amount)],
    });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [
        await handleSetField(
          interaction.guild.id,
          interaction.user.id,
          interaction.options.getUser('user'),
          'chips',
          interaction.options.getInteger('amount'),
        ),
      ],
      ephemeral: true,
    });
  },
};

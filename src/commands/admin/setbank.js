const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleSetField } = require('../../utils/adminTools');

module.exports = {
  name: 'setbank',
  aliases: [],
  description: "Set a user's bank balance.",
  usage: '<@user> <amount>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('setbank')
    .setDescription("Set a user's bank balance")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption((option) =>
      option.setName('amount').setDescription('Bank amount').setRequired(true).setMinValue(0),
    ),

  async execute({ message, args }) {
    const target = parseMentionTarget(message);
    const amount = parseInt(args[1], 10);
    if (!target || Number.isNaN(amount)) {
      return message.reply({ embeds: [embed.error('Usage: `.setbank @user <amount>`')] });
    }
    return message.reply({
      embeds: [await handleSetField(message.guild.id, message.author.id, target, 'bank', amount)],
    });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [
        await handleSetField(
          interaction.guild.id,
          interaction.user.id,
          interaction.options.getUser('user'),
          'bank',
          interaction.options.getInteger('amount'),
        ),
      ],
      ephemeral: true,
    });
  },
};

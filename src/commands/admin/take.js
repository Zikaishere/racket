const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { parseMentionTarget, handleTake } = require('../../utils/adminTools');

module.exports = {
  name: 'take',
  aliases: [],
  description: 'Take wallet money from a user.',
  usage: '<@user> <amount>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('take')
    .setDescription('Take wallet money from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption((option) => option.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),

  async execute({ message, args }) {
    const target = parseMentionTarget(message);
    const amount = parseInt(args[1], 10);
    if (!target || Number.isNaN(amount)) {
      return message.reply({ embeds: [embed.error('Usage: `.take @user <amount>`')] });
    }
    return message.reply({ embeds: [await handleTake(message.guild.id, message.author.id, target, amount)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [
        await handleTake(
          interaction.guild.id,
          interaction.user.id,
          interaction.options.getUser('user'),
          interaction.options.getInteger('amount'),
        ),
      ],
      ephemeral: true,
    });
  },
};

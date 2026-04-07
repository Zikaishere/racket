const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { DEFAULT_PREFIX } = require('../../config');

function buildInfoEmbed(prefix = DEFAULT_PREFIX) {
  return embed.raw(0xA1CF3A)
    .setTitle('Racket | General Information')
    .setDescription('Racket is a server economy bot with casino games, heists, black market trading, and admin tools for managing the experience.')
    .addFields(
      { name: 'Start Here', value: `Use \`${prefix}help\` or \`/help\` to browse all commands.`, inline: false },
      { name: 'Setup', value: `Admins can use \`${prefix}configstatus\`, \`${prefix}config\`, and \`${prefix}setuphere\` to configure the bot.`, inline: false },
      { name: 'Features', value: 'Economy, casino, heists, black market, leaderboards, and configurable server settings.', inline: false },
      { name: 'Support', value: 'Use the appropriate support channels for questions, bug reports, and suggestions.', inline: false },
    );
}

module.exports = {
  name: 'info',
  aliases: ['about'],
  description: 'Post the server info embed in the current channel.',
  usage: '',
  category: 'info',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Post the server info embed in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message, prefix }) {
    await message.channel.send({ embeds: [buildInfoEmbed(prefix || DEFAULT_PREFIX)] });
    return message.reply({ embeds: [embed.success('Info Posted', `I posted the info embed in ${message.channel}.`)] });
  },

  async executeSlash({ interaction, guildData }) {
    await interaction.channel.send({ embeds: [buildInfoEmbed(guildData?.prefix || DEFAULT_PREFIX)] });
    return interaction.reply({ embeds: [embed.success('Info Posted', `I posted the info embed in ${interaction.channel}.`)], ephemeral: true });
  },
};

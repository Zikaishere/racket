const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { DEFAULT_PREFIX } = require('../../config');
const { postSetupGuide, getGuildConfig } = require('../../utils/configTools');

module.exports = {
  name: 'setuphere',
  aliases: ['postsetup'],
  description: 'Post the setup guide in the current channel.',
  usage: '',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('setuphere')
    .setDescription('Post the setup guide in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message, prefix, guildData }) {
    const currentGuildData = guildData || await getGuildConfig(message.guild.id);
    try {
      await postSetupGuide(message.channel, prefix || currentGuildData.prefix || DEFAULT_PREFIX);
    } catch (error) {
      return message.reply({ embeds: [embed.error('I could not post the setup guide in this channel. Check my permissions and try again.')] });
    }
    return message.reply({ embeds: [embed.success('Setup Guide Posted', `I posted the setup guide in ${message.channel}.`)] });
  },

  async executeSlash({ interaction, guildData }) {
    const currentGuildData = guildData || await getGuildConfig(interaction.guild.id);
    try {
      await postSetupGuide(interaction.channel, currentGuildData.prefix || DEFAULT_PREFIX);
    } catch (error) {
      return interaction.reply({ embeds: [embed.error('I could not post the setup guide in this channel. Check my permissions and try again.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [embed.success('Setup Guide Posted', `I posted the setup guide in ${interaction.channel}.`)], ephemeral: true });
  },
};

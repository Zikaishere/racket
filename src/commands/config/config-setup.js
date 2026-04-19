const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { postSetupGuide } = require('../../utils/configTools');

module.exports = {
  name: 'config-setup',
  aliases: ['setup', 'setuphere'],
  description: 'Post the interactive server configuration wizard in this channel.',
  usage: '',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('config-setup')
    .setDescription('Post the configuration wizard in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message, prefix }) {
    await postSetupGuide(message.channel, prefix);
    if (message.deletable)
      await message.delete().catch((err) => {
        console.warn('[Setup] Failed to delete message:', err.message);
      });
  },

  async executeSlash({ interaction, guildData }) {
    await postSetupGuide(interaction.channel, guildData?.prefix);
    return interaction.reply({ content: 'Setup wizard posted.', ephemeral: true });
  },

  components: {
    config_setup_guide: async ({ interaction, prefix }) => {
      await postSetupGuide(interaction.channel, prefix);
      return interaction.reply({ content: 'Setup wizard posted.', ephemeral: true });
    }
  }
};

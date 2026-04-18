const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { SUGGESTION_CHANNEL_ID } = require('../../config');

module.exports = {
  name: 'suggestion',
  aliases: ['suggest'],
  description: 'Send a suggestion to the developers.',
  usage: '<your suggestion>',
  category: 'info',

  slash: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Send a suggestion to the developers.')
    .addStringOption((option) => option.setName('content').setDescription('Your suggestion').setRequired(true)),

  async execute({ message, args, client }) {
    if (!args.length) return message.reply({ embeds: [embed.error('Please provide a suggestion.')] });
    const content = args.join(' ');
    await this.sendSuggestion(client, message.author, content);
    return message.reply({ embeds: [embed.success('Your suggestion has been sent to the developers. Thank you!')] });
  },

  async executeSlash({ interaction, client }) {
    const content = interaction.options.getString('content');
    await this.sendSuggestion(client, interaction.user, content);
    return interaction.reply({
      embeds: [embed.success('Your suggestion has been sent to the developers. Thank you!')],
      ephemeral: true,
    });
  },

  async sendSuggestion(client, user, content) {
    const channel = await client.channels.fetch(SUGGESTION_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;

    const e = embed
      .raw(0xa1cf3a)
      .setTitle('💡 New Suggestion')
      .setDescription(content || "No suggestion provided.")
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await channel.send({ embeds: [e] }).catch(() => null);
  },
};

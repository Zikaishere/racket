const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { SUGGESTION_CHANNEL_ID, SUGGESTION_ACCEPTED_CHANNEL_ID, COLOR_ERROR } = require('../../config');

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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('suggestion_add').setLabel('Add').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('suggestion_reject').setLabel('Reject').setStyle(ButtonStyle.Danger),
    );

    await channel.send({ embeds: [e], components: [row] }).catch(() => null);
  },

  components: {
    suggestion_add: async ({ interaction, client }) => {
      const acceptedChannel = await client.channels.fetch(SUGGESTION_ACCEPTED_CHANNEL_ID).catch(() => null);
      if (!acceptedChannel?.isTextBased()) {
        return interaction.reply({ content: 'Could not find the accepted suggestions channel.', ephemeral: true });
      }

      const oldEmbed = interaction.message.embeds[0];
      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setTitle('✅ Suggestion Accepted')
        .setTimestamp();

      await acceptedChannel.send({ embeds: [newEmbed] });
      await interaction.message.delete().catch(() => null);
    },
    suggestion_reject: async ({ interaction }) => {
      const oldEmbed = interaction.message.embeds[0];
      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(COLOR_ERROR)
        .setTitle('❌ Suggestion Rejected')
        .setTimestamp();

      await interaction.update({
        embeds: [newEmbed],
        components: [], // Remove buttons
      });
    },
  },
};

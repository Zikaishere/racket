const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { BUG_REPORT_CHANNEL_ID } = require('../../config');

module.exports = {
  name: 'bug-report',
  aliases: ['bugreport', 'bug'],
  description: 'Report a bug or issue to the developers.',
  usage: '<description> [error_id]',
  category: 'info',

  slash: new SlashCommandBuilder()
    .setName('bug-report')
    .setDescription('Report a bug or issue to the developers.')
    .addStringOption((option) =>
      option.setName('description').setDescription('Describe the bug or issue').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('error_id').setDescription('The Error ID provided by the bot (if any)').setRequired(false),
    ),

  async execute({ message, args, client }) {
    if (!args.length) return message.reply({ embeds: [embed.error('Please provide a description of the bug.')] });

    let errorId = null;
    let descArgs = [...args];
    if (descArgs[descArgs.length - 1].toUpperCase().startsWith('ERR-')) {
      errorId = descArgs.pop().toUpperCase();
    }
    const description = descArgs.join(' ');
    if (!description && errorId)
      return message.reply({ embeds: [embed.error('Please provide a description of the bug.')] });

    await this.sendBugReport(client, message.author, description, errorId);
    return message.reply({ embeds: [embed.success('Your bug report has been sent. Thank you for your help!')] });
  },

  async executeSlash({ interaction, client }) {
    const description = interaction.options.getString('description');
    const errorId = interaction.options.getString('error_id');

    await this.sendBugReport(client, interaction.user, description, errorId);
    return interaction.reply({
      embeds: [embed.success('Your bug report has been sent. Thank you for your help!')],
      ephemeral: true,
    });
  },

  async sendBugReport(client, user, description, errorId) {
    const channel = await client.channels.fetch(BUG_REPORT_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;

    const e = embed
      .raw(0xff6b6b)
      .setTitle('🐛 New Bug Report')
      .setDescription(description)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    if (errorId) {
      e.addFields({ name: 'Error ID', value: `\`${errorId}\``, inline: false });
    }

    await channel.send({ embeds: [e] }).catch(() => null);
  },
};

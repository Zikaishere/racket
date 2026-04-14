const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const ErrorLog = require('../../models/ErrorLog');

module.exports = {
  name: 'error-inspect',
  description: 'Inspect a logged error by its ID.',
  usage: '<errorId>',
  category: 'admin',
  adminOnly: true,
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('error-inspect')
    .setDescription('Inspect a logged error by its ID')
    .addStringOption((option) =>
      option.setName('id').setDescription('The Error ID (e.g. ERR-ABC123)').setRequired(true),
    ),

  async execute({ message, args }) {
    if (!args[0]) return message.reply({ embeds: [embed.error('Please provide an Error ID.')] });

    const errorLog = await ErrorLog.findOne({ errorId: args[0].toUpperCase() });
    if (!errorLog) return message.reply({ embeds: [embed.error(`No error log found for ID: \`${args[0]}\``)] });

    return message.reply({ embeds: [this.buildErrorEmbed(errorLog)] });
  },

  async executeSlash({ interaction }) {
    const errorId = interaction.options.getString('id').toUpperCase();

    const errorLog = await ErrorLog.findOne({ errorId });
    if (!errorLog)
      return interaction.reply({ embeds: [embed.error(`No error log found for ID: \`${errorId}\``)], ephemeral: true });

    return interaction.reply({ embeds: [this.buildErrorEmbed(errorLog)], ephemeral: true });
  },

  buildErrorEmbed(log) {
    const e = embed
      .raw(0xff6b6b)
      .setTitle(`Error Inspection: ${log.errorId}`)
      .setDescription(`**Message:** ${log.message}`)
      .addFields(
        { name: 'Source', value: log.source || 'Unknown', inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(log.createdAt.getTime() / 1000)}:F>`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'User', value: log.userId ? `<@${log.userId}> (\`${log.userId}\`)` : 'N/A', inline: true },
        { name: 'Guild', value: log.guildId ? `\`${log.guildId}\`` : 'N/A', inline: true },
        { name: 'Command', value: log.commandName || 'N/A', inline: true },
      );

    if (log.stack) {
      e.addFields({
        name: 'Stack Trace',
        value: `\`\`\`js\n${log.stack.slice(0, 1000)}${log.stack.length > 1000 ? '...' : ''}\n\`\`\``,
      });
    }

    if (log.metadata && Object.keys(log.metadata).length > 0) {
      e.addFields({
        name: 'Metadata',
        value: `\`\`\`json\n${JSON.stringify(log.metadata, null, 2).slice(0, 1000)}\n\`\`\``,
      });
    }

    return e;
  },
};

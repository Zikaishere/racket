const embed = require('../../utils/embed');
const ErrorLog = require('../../models/ErrorLog');

module.exports = {
  name: 'errorlookup',
  aliases: ['errlookup', 'finderror'],
  description: 'Look up a logged error by its error ID.',
  usage: '<errorId>',
  category: 'dev',
  devOnly: true,

  async execute({ message, args }) {
    const errorId = args[0]?.toUpperCase();
    if (!errorId) {
      return message.reply({ embeds: [embed.error('Usage: `rack errorlookup <errorId>`')] });
    }

    const errorLog = await ErrorLog.findOne({ errorId });
    if (!errorLog) {
      return message.reply({ embeds: [embed.error(`No logged error was found for \`${errorId}\`.`)] });
    }

    const details = [
      `**Source:** ${errorLog.source}`,
      `**Command:** ${errorLog.commandName || 'n/a'}`,
      `**User ID:** ${errorLog.userId || 'n/a'}`,
      `**Guild ID:** ${errorLog.guildId || 'n/a'}`,
      `**Channel ID:** ${errorLog.channelId || 'n/a'}`,
      `**Created:** <t:${Math.floor(new Date(errorLog.createdAt).getTime() / 1000)}:F>`,
      '',
      `**Message:** ${String(errorLog.message || 'Unknown error').slice(0, 1000)}`,
      '',
      `**Stack:**\n\`\`\`\n${String(errorLog.stack || 'No stack recorded.').slice(0, 1500)}\n\`\`\``,
    ].join('\n');

    return message.reply({
      embeds: [embed.info(`Error Lookup: ${errorId}`, details)],
    });
  },
};

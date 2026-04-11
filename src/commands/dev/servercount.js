const embed = require('../../utils/embed');

module.exports = {
  name: 'servercount',
  aliases: ['guildcount', 'servers'],
  description: 'Show how many servers the bot is currently in.',
  usage: '',
  category: 'dev',
  devOnly: true,

  async execute({ message, client }) {
    const guilds = [...client.guilds.cache.values()];
    const preview = guilds
      .slice(0, 10)
      .map((guild) => `• ${guild.name} (\`${guild.id}\`)`)
      .join('\n');

    return message.reply({
      embeds: [
        embed.info(
          'Server Count',
          `Current servers: **${guilds.length}**${preview ? `\n\n${preview}${guilds.length > 10 ? '\n...' : ''}` : ''}`,
        ),
      ],
    });
  },
};

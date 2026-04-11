const embed = require('../../utils/embed');

module.exports = {
  name: 'devhelp',
  aliases: [],
  description: 'Show available dev-only commands.',
  usage: '',
  category: 'dev',
  devOnly: true,

  async execute({ message, client, prefix }) {
    const names = client.categories.get('dev') || [];
    const lines = names
      .map((name) => client.commands.get(name))
      .filter(Boolean)
      .map((cmd) => `**\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ''}\`**\n${cmd.description}`);

    return message.reply({
      embeds: [embed.info('Developer Help', lines.join('\n\n') || 'No dev commands loaded.')],
    });
  },
};

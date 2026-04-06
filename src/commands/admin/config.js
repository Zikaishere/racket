const embed = require('../../utils/embed');

module.exports = {
  name: 'legacyconfig',
  aliases: ['configlegacy'],
  description: 'Legacy config bridge command.',
  usage: '',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,
  hidden: true,

  async execute({ message, prefix }) {
    return message.reply({ embeds: [embed.info('Config Moved', `Configuration now uses standalone commands. Try \`${prefix}config\` or \`${prefix}configsetup\`.`)] });
  },
};

const embed = require('../../utils/embed');
const { DEV_IDS, DEV_PREFIX } = require('../../config');
const { createDbWipeRequest, CONFIRMATION_WINDOW_MS } = require('../../utils/devDanger');

const OWNER_ID = DEV_IDS[0];

module.exports = {
  name: 'dbwipe',
  aliases: ['deletedb'],
  description: 'Create a confirmation token for wiping the entire database.',
  usage: '',
  category: 'dev',
  devOnly: true,

  async execute({ message }) {
    if (message.author.id !== OWNER_ID) {
      return message.reply({ embeds: [embed.error('Only the primary developer can use this command.')] });
    }

    const request = createDbWipeRequest(message.author.id);
    const minutes = Math.ceil(CONFIRMATION_WINDOW_MS / 60000);
    return message.reply({
      embeds: [
        embed.warning(
          'Database Wipe Confirmation Required',
          `This will delete the entire Mongo database for the bot.\n\nTo confirm, run \`${DEV_PREFIX}confirmdbwipe ${request.token}\` within ${minutes} minute(s).`
        ),
      ],
    });
  },
};

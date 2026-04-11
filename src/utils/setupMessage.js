const embed = require('./embed');
const { DEFAULT_PREFIX } = require('../config');

function buildSetupEmbed(prefix = DEFAULT_PREFIX) {
  return embed
    .raw(0xe63946)
    .setTitle('Thanks for adding Racket')
    .setDescription('Here is the fastest way to get the bot set up in your server.')
    .addFields(
      { name: '1. Check current setup', value: `Use \`${prefix}configstatus\` or \`/configstatus\`.`, inline: false },
      {
        name: '2. Post this guide again',
        value: `Use \`${prefix}setuphere\` in the channel where you want the setup guide posted.`,
        inline: false,
      },
      { name: '3. Set your prefix', value: `Use \`${prefix}setprefix <newPrefix>\`.`, inline: false },
      {
        name: '4. Add admin roles',
        value: `Use \`${prefix}adminrole add @Role\` so trusted staff can manage the bot.`,
        inline: false,
      },
      {
        name: '5. Toggle features or commands',
        value: `Use \`${prefix}togglefeature <casino|heist|blackmarket> <on|off>\` or \`${prefix}togglecommand <name> <on|off>\`.`,
        inline: false,
      },
      {
        name: '6. See what can be changed',
        value: `Use \`${prefix}configcommands\` to list toggleable commands and \`${prefix}config\` for the setup overview.`,
        inline: false,
      },
      { name: '7. Browse commands', value: `Use \`${prefix}help\` or \`/help\`.`, inline: false },
      {
        name: 'Who can configure?',
        value:
          'Discord Administrators can already use the config and admin command sets even before admin roles are added.',
        inline: false,
      },
    );
}

module.exports = { buildSetupEmbed };

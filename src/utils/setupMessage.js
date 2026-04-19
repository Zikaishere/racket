const embed = require('./embed');
const { DEFAULT_PREFIX } = require('../config');

function buildSetupEmbed(prefix = DEFAULT_PREFIX) {
  return embed
    .raw(0xe63946)
    .setTitle('Thanks for adding Racket')
    .setDescription('Here is the fastest way to get the bot set up in your server.')
    .addFields(
      { name: '1. Check current setup', value: `Use \`${prefix}config view\` or \`/config view\`.`, inline: false },
      {
        name: '2. Post this guide again',
        value: `Use \`${prefix}config-setup\` in the channel where you want the setup guide posted.`,
        inline: false,
      },
      { name: '3. Set your prefix', value: `Use \`${prefix}config prefix <newPrefix>\`.`, inline: false },
      {
        name: '4. Add admin roles',
        value: `Use \`${prefix}config adminrole <@Role> add\` so trusted staff can manage the bot.`,
        inline: false,
      },
      {
        name: '5. Toggle features or commands',
        value: `Use \`${prefix}config feature <casino|heist|blackmarket> <on|off>\` or \`${prefix}config command <name> <on|off>\`.`,
        inline: false,
      },
      {
        name: '🚀 New: Player Onboarding',
        value: `New to Racket? Use \`${prefix}onboarding\` or \`/onboarding\` for a quick start guide and feature overview!`,
        inline: false,
      },
      {
        name: 'Who can configure?',
        value:
          'Discord Administrators can already use the config and admin command sets even before admin roles are added.',
        inline: false,
      },
    );
}

module.exports = { buildSetupEmbed };

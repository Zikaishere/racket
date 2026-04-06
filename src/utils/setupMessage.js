const embed = require('./embed');
const { DEFAULT_PREFIX } = require('../config');

function buildSetupEmbed(prefix = DEFAULT_PREFIX) {
  return embed.raw(0xE63946)
    .setTitle('Thanks for adding Racket')
    .setDescription('Here is the fastest way to get the bot set up in your server.')
    .addFields(
      { name: '1. Check current setup', value: `Use \`${prefix}config status\` or \`/config status\`.`, inline: false },
      { name: '2. Set your prefix', value: `Use \`${prefix}config prefix <newPrefix>\`.`, inline: false },
      { name: '3. Add admin roles', value: `Use \`${prefix}config adminrole add @Role\` so trusted staff can manage the bot.`, inline: false },
      { name: '4. Toggle features or commands', value: `Use \`${prefix}config feature <casino|heist|blackmarket> <on|off>\` or \`${prefix}config command <name> <on|off>\`.`, inline: false },
      { name: '5. Discover what can be configured', value: `Use \`${prefix}config commands\` to see toggleable commands and \`${prefix}config status\` for the current setup.`, inline: false },
      { name: '6. Browse commands', value: `Use \`${prefix}help\` or \`/help\`.`, inline: false },
      { name: 'Who can configure?', value: 'Discord Administrators can already use `config` and `admin` even before admin roles are added.', inline: false },
    );
}

module.exports = { buildSetupEmbed };

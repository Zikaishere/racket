const Guild = require('../models/Guild');
const User = require('../models/User');
const embed = require('../utils/embed');
const { DEFAULT_PREFIX, DEV_PREFIX, DEV_IDS } = require('../config');
const { getDisabledCommandReason, isRestrictedCategory } = require('../utils/commandAccess');
const { logError, buildUserErrorEmbed } = require('../utils/errorManager');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    const isDev = DEV_IDS.includes(message.author.id);

    if (message.content.startsWith(DEV_PREFIX)) {
      if (!isDev) return;

      const args = message.content.slice(DEV_PREFIX.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const command = client.commands.get(commandName)
        || client.commands.get(client.aliases.get(commandName));

      if (!command) return;

      if (command.slashOnly) {
        return message.reply({ embeds: [embed.error('This command can only be used as a slash command.')] });
      }

      if (command.guildOnly && !message.guild) {
        return message.reply({ embeds: [embed.error('This command can only be used in a server.')] });
      }

      const guildData = message.guild ? await Guild.findOrCreate(message.guild.id) : null;

      try {
        await command.execute({ message, args, client, prefix: DEV_PREFIX, isDev: true, guildData });
      } catch (err) {
        const errorId = await logError(err, {
          source: 'message_dev_command',
          commandName: command.name,
          userId: message.author.id,
          guildId: message.guild?.id || null,
          channelId: message.channel?.id || null,
          metadata: { args },
        }, client);
        message.reply({ embeds: [buildUserErrorEmbed(errorId)] });
      }
      return;
    }

    if (!message.guild) return;

    // Get server prefix
    const guildData = await Guild.findOrCreate(message.guild.id);
    const prefix = guildData.prefix || DEFAULT_PREFIX;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Resolve command or alias
    const command = client.commands.get(commandName)
      || client.commands.get(client.aliases.get(commandName));

    if (!command) return;
    if (command.devOnly) return;

    const disabledReason = getDisabledCommandReason(guildData, command);
    if (disabledReason) {
      return message.reply({ embeds: [embed.error(disabledReason)] });
    }

    if (!command.adminOnly && isRestrictedCategory(command)) {
      const user = await User.findOrCreate(message.author.id, message.guild.id);
      if (user.moderation?.globallyBanned) {
        const reason = user.moderation.globalBanReason ? `\nReason: ${user.moderation.globalBanReason}` : '';
        return message.reply({ embeds: [embed.error(`You are globally banned from using economy and game features.${reason}`)] });
      }
      if (user.moderation?.frozen) {
        const reason = user.moderation.freezeReason ? `\nReason: ${user.moderation.freezeReason}` : '';
        return message.reply({ embeds: [embed.error(`Your account is frozen and cannot use economy features right now.${reason}`)] });
      }
    }

    // Slash-only commands can't be used with prefix
    if (command.slashOnly) {
      return message.reply({ embeds: [embed.error('This command can only be used as a slash command.')] });
    }

    // Guild-only check
    if (command.guildOnly && !message.guild) {
      return message.reply({ embeds: [embed.error('This command can only be used in a server.')] });
    }

    // Admin check
    if (command.adminOnly) {
      const isAdmin = message.member.permissions.has('Administrator')
        || guildData.adminRoles.some(r => message.member.roles.cache.has(r));
      if (!isAdmin) return message.reply({ embeds: [embed.error('You need to be an administrator to use this command.')] });
    }

    // Run the command
    try {
      await command.execute({ message, args, client, guildData, prefix });
    } catch (err) {
      const errorId = await logError(err, {
        source: 'message_command',
        commandName: command.name,
        userId: message.author.id,
        guildId: message.guild?.id || null,
        channelId: message.channel?.id || null,
        metadata: { args },
      }, client);
      message.reply({ embeds: [buildUserErrorEmbed(errorId)] });
    }
  }
};

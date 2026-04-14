const Guild = require('../models/Guild');
const User = require('../models/User');
const embed = require('../utils/embed');
const { getDisabledCommandReason, isRestrictedCategory } = require('../utils/commandAccess');
const { logError, buildUserErrorEmbed } = require('../utils/errorManager');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    const guildData = interaction.guild ? await Guild.findOrCreate(interaction.guild.id) : null;

    // ── Slash Commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.slash) return;

      const disabledReason = getDisabledCommandReason(guildData, command);
      if (disabledReason) {
        return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
      }

      if (!command.adminOnly && interaction.guild && isRestrictedCategory(command)) {
        const user = await User.findOrCreate(interaction.user.id, interaction.guild.id);
        if (user.moderation?.globallyBanned) {
          const reason = user.moderation.globalBanReason ? `\nReason: ${user.moderation.globalBanReason}` : '';
          return interaction.reply({
            embeds: [embed.error(`You are globally banned from using economy and game features.${reason}`)],
            ephemeral: true,
          });
        }
        if (user.moderation?.frozen) {
          const reason = user.moderation.freezeReason ? `\nReason: ${user.moderation.freezeReason}` : '';
          return interaction.reply({
            embeds: [embed.error(`Your account is frozen and cannot use economy features right now.${reason}`)],
            ephemeral: true,
          });
        }
      }

      if (command.adminOnly && interaction.guild) {
        const isAdmin =
          interaction.member.permissions.has('Administrator') ||
          (guildData?.adminRoles || []).some((r) => interaction.member.roles.cache.has(r));
        if (!isAdmin)
          return interaction.reply({
            embeds: [embed.error('You need to be an administrator to use this command.')],
            ephemeral: true,
          });
      }

      try {
        await command.executeSlash({ interaction, client, guildData });
      } catch (err) {
        const errorId = await logError(
          err,
          {
            source: 'slash_command',
            commandName: command.name,
            userId: interaction.user.id,
            guildId: interaction.guild?.id || null,
            channelId: interaction.channel?.id || null,
            interactionType: 'chat_input',
            metadata: { commandName: interaction.commandName },
          },
          client,
        );
        const e = buildUserErrorEmbed(errorId);
        interaction.replied || interaction.deferred
          ? interaction.followUp({ embeds: [e], ephemeral: true })
          : interaction.reply({ embeds: [e], ephemeral: true });
      }
      return;
    }

    // ── Component Interactions (Buttons & Menus) ──────────────────────────────
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const id = interaction.customId;

      // Find a handler by full ID or prefix
      let handler = client.components.get(id);
      let handlerKey = id;

      if (!handler) {
        // Try matching prefixes (e.g., 'heist_' matches 'heist_start')
        for (const [prefix, h] of client.components.entries()) {
          if (id.startsWith(prefix)) {
            handler = h;
            handlerKey = prefix;
            break;
          }
        }
      }

      if (handler) {
        // Check if the command this component belongs to is disabled
        // We assume the handlerKey/prefix often corresponds to the command category or name
        // but for safety, we allow the handler to define its own parent command check.
        try {
          return await handler({ interaction, client, guildData });
        } catch (err) {
          const errorId = await logError(
            err,
            {
              source: interaction.isButton() ? 'button_interaction' : 'select_menu_interaction',
              userId: interaction.user.id,
              guildId: interaction.guild?.id || null,
              channelId: interaction.channel?.id || null,
              metadata: { customId: id, handlerKey },
            },
            client,
          );
          const e = buildUserErrorEmbed(errorId);
          return interaction.replied || interaction.deferred
            ? interaction.followUp({ embeds: [e], ephemeral: true })
            : interaction.reply({ embeds: [e], ephemeral: true });
        }
      }
    }
  },
};

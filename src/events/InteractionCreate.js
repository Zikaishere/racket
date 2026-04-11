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

    // ── Buttons ─────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Blackjack buttons
      if (
        id.startsWith('bj_hit_') ||
        id.startsWith('bj_stand_') ||
        id.startsWith('bj_join_') ||
        id.startsWith('bj_start_') ||
        id.startsWith('bj_leave_')
      ) {
        const blackjack = client.commands.get('blackjack');
        const disabledReason = getDisabledCommandReason(guildData, blackjack);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        try {
          return await blackjack?.handleButton(interaction);
        } catch (err) {
          const errorId = await logError(
            err,
            {
              source: 'button_interaction',
              commandName: 'blackjack',
              userId: interaction.user.id,
              guildId: interaction.guild?.id || null,
              channelId: interaction.channel?.id || null,
              interactionType: 'button',
              metadata: { customId: id },
            },
            client,
          );
          return interaction.replied || interaction.deferred
            ? interaction.followUp({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true })
            : interaction.reply({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true });
        }
      }

      // Double or Nothing buttons
      if (id === 'double_flip' || id === 'double_take') {
        const double = client.commands.get('double');
        const disabledReason = getDisabledCommandReason(guildData, double);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        try {
          return await double?.handleButton(interaction);
        } catch (err) {
          const errorId = await logError(
            err,
            {
              source: 'button_interaction',
              commandName: 'double',
              userId: interaction.user.id,
              guildId: interaction.guild?.id || null,
              channelId: interaction.channel?.id || null,
              interactionType: 'button',
              metadata: { customId: id },
            },
            client,
          );
          return interaction.replied || interaction.deferred
            ? interaction.followUp({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true })
            : interaction.reply({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true });
        }
      }

      // Vault buttons
      if (id === 'vault_crack' || id === 'vault_take') {
        const vault = client.commands.get('vault');
        const disabledReason = getDisabledCommandReason(guildData, vault);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        try {
          return await vault?.handleButton(interaction);
        } catch (err) {
          const errorId = await logError(
            err,
            {
              source: 'button_interaction',
              commandName: 'vault',
              userId: interaction.user.id,
              guildId: interaction.guild?.id || null,
              channelId: interaction.channel?.id || null,
              interactionType: 'button',
              metadata: { customId: id },
            },
            client,
          );
          return interaction.replied || interaction.deferred
            ? interaction.followUp({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true })
            : interaction.reply({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true });
        }
      }

      // Heist planning buttons
      if (id.startsWith('heist_')) {
        const heist = client.commands.get('heist');
        const disabledReason = getDisabledCommandReason(guildData, heist);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        try {
          return await heist?.handleButton(interaction, client);
        } catch (err) {
          const errorId = await logError(
            err,
            {
              source: 'button_interaction',
              commandName: 'heist',
              userId: interaction.user.id,
              guildId: interaction.guild?.id || null,
              channelId: interaction.channel?.id || null,
              interactionType: 'button',
              metadata: { customId: id },
            },
            client,
          );
          return interaction.replied || interaction.deferred
            ? interaction.followUp({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true })
            : interaction.reply({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true });
        }
      }

      return;
    }

    // ── Select Menus ─────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'casino_nav') {
        const lobby = client.commands.get('lobby');
        const disabledReason = getDisabledCommandReason(guildData, lobby);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        try {
          return await lobby?.handleNav(interaction);
        } catch (err) {
          const errorId = await logError(
            err,
            {
              source: 'select_menu_interaction',
              commandName: 'lobby',
              userId: interaction.user.id,
              guildId: interaction.guild?.id || null,
              channelId: interaction.channel?.id || null,
              interactionType: 'select_menu',
              metadata: { customId: id },
            },
            client,
          );
          return interaction.replied || interaction.deferred
            ? interaction.followUp({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true })
            : interaction.reply({ embeds: [buildUserErrorEmbed(errorId)], ephemeral: true });
        }
      }
      // Help menu is handled by its own collector inside help.js
      return;
    }
  },
};

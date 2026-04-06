const Guild = require('../models/Guild');
const User = require('../models/User');
const embed = require('../utils/embed');
const { getDisabledCommandReason, isRestrictedCategory } = require('../utils/commandAccess');

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
          return interaction.reply({ embeds: [embed.error(`You are globally banned from using economy and game features.${reason}`)], ephemeral: true });
        }
        if (user.moderation?.frozen) {
          const reason = user.moderation.freezeReason ? `\nReason: ${user.moderation.freezeReason}` : '';
          return interaction.reply({ embeds: [embed.error(`Your account is frozen and cannot use economy features right now.${reason}`)], ephemeral: true });
        }
      }

      if (command.adminOnly && interaction.guild) {
        const isAdmin = interaction.member.permissions.has('Administrator')
          || (guildData?.adminRoles || []).some(r => interaction.member.roles.cache.has(r));
        if (!isAdmin)
          return interaction.reply({ embeds: [embed.error('You need to be an administrator to use this command.')], ephemeral: true });
      }

      try {
        await command.executeSlash({ interaction, client, guildData });
      } catch (err) {
        console.error(`Slash error [${command.name}]:`, err);
        const e = embed.error('Something went wrong while running that command.');
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
      if (id.startsWith('bj_hit_') || id.startsWith('bj_stand_') || id.startsWith('bj_join_') || id.startsWith('bj_start_') || id.startsWith('bj_leave_')) {
        const blackjack = client.commands.get('blackjack');
        const disabledReason = getDisabledCommandReason(guildData, blackjack);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        return blackjack?.handleButton(interaction);
      }

      // Double or Nothing buttons
      if (id === 'double_flip' || id === 'double_take') {
        const double = client.commands.get('double');
        const disabledReason = getDisabledCommandReason(guildData, double);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        return double?.handleButton(interaction);
      }

      // Vault buttons
      if (id === 'vault_crack' || id === 'vault_take') {
        const vault = client.commands.get('vault');
        const disabledReason = getDisabledCommandReason(guildData, vault);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        return vault?.handleButton(interaction);
      }

      // Heist planning buttons
      if (id.startsWith('heist_')) {
        const heist = client.commands.get('heist');
        const disabledReason = getDisabledCommandReason(guildData, heist);
        if (disabledReason) {
          return interaction.reply({ embeds: [embed.error(disabledReason)], ephemeral: true });
        }
        return heist?.handleButton(interaction, client);
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
        return lobby?.handleNav(interaction);
      }
      // Help menu is handled by its own collector inside help.js
      return;
    }
  }
};

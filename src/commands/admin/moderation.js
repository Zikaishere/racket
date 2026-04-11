const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const {
  handleFreeze,
  handleUnfreeze,
  handleReset,
  handleResetAll,
  buildStatusEmbed,
  buildAuditEmbed,
} = require('../../utils/adminTools');

module.exports = {
  name: 'moderation',
  aliases: ['mod'],
  description: 'Manage users, audit logs, and global resets.',
  usage: '<freeze|unfreeze|reset|resetall|audit|status> [options]',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Admin tools for server moderation and audits')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('freeze')
        .setDescription('Freeze a user from playing economy games')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for freezing').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('unfreeze')
        .setDescription('Unfreeze a user')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Check admin-level flags of a user')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset ALL balances and chips for a user')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('resetall').setDescription('WARNING: Wipe entire server economy balances'))
    .addSubcommand((sub) =>
      sub
        .setName('audit')
        .setDescription('View recent admin audit logs')
        .addIntegerOption((opt) =>
          opt.setName('count').setDescription('Number of logs').setMinValue(1).setMaxValue(10),
        ),
    ),

  async execute({ message, args }) {
    if (!args.length)
      return message.reply({
        embeds: [embed.error('Usage: `.moderation <freeze|unfreeze|reset|resetall|audit|status>`')],
      });
    const sub = args[0].toLowerCase();
    const guildId = message.guild.id;
    const actorId = message.author.id;

    if (sub === 'audit') {
      const count = Number(args[1]) || 5;
      return message.reply({ embeds: [await buildAuditEmbed(guildId, count)] });
    }

    if (sub === 'resetall') {
      return message.reply({ embeds: [await handleResetAll(guildId, actorId)] });
    }

    const target = message.mentions.users.first() || (await message.client.users.fetch(args[1]).catch(() => null));
    if (!target) return message.reply({ embeds: [embed.error('User not found.')] });

    if (sub === 'freeze') {
      const reason = args.slice(2).join(' ') || null;
      return message.reply({ embeds: [await handleFreeze(guildId, actorId, target, reason)] });
    }

    if (sub === 'unfreeze') {
      return message.reply({ embeds: [await handleUnfreeze(guildId, actorId, target)] });
    }

    if (sub === 'status') {
      return message.reply({ embeds: [await buildStatusEmbed(guildId, target)] });
    }

    if (sub === 'reset') {
      return message.reply({ embeds: [await handleReset(guildId, actorId, target)] });
    }

    return message.reply({ embeds: [embed.error('Unknown moderation command.')] });
  },

  async executeSlash({ interaction }) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const actorId = interaction.user.id;

    if (sub === 'audit') {
      const count = interaction.options.getInteger('count') || 5;
      return interaction.reply({ embeds: [await buildAuditEmbed(guildId, count)], ephemeral: true });
    }

    if (sub === 'resetall') {
      return interaction.reply({ embeds: [await handleResetAll(guildId, actorId)], ephemeral: true });
    }

    const target = interaction.options.getUser('target');

    if (sub === 'freeze') {
      const reason = interaction.options.getString('reason');
      return interaction.reply({ embeds: [await handleFreeze(guildId, actorId, target, reason)], ephemeral: true });
    }

    if (sub === 'unfreeze') {
      return interaction.reply({ embeds: [await handleUnfreeze(guildId, actorId, target)], ephemeral: true });
    }

    if (sub === 'status') {
      return interaction.reply({ embeds: [await buildStatusEmbed(guildId, target)], ephemeral: true });
    }

    if (sub === 'reset') {
      return interaction.reply({ embeds: [await handleReset(guildId, actorId, target)], ephemeral: true });
    }
  },
};

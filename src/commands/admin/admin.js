const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const Guild = require('../../models/Guild');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { logAudit } = require('../../utils/audit');

const FEATURE_CHOICES = [
  { name: 'Casino', value: 'casino' },
  { name: 'Heist', value: 'heist' },
  { name: 'Black Market', value: 'blackmarket' },
];

const parseMentionTarget = (message) => message.mentions.users.first();

async function setUserValues(guildId, targetId, updates) {
  return User.findOneAndUpdate(
    { userId: targetId, guildId },
    { $set: updates, $setOnInsert: { userId: targetId, guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function buildStatusEmbed(guildId, target) {
  const user = await getUser(target.id, guildId);
  return embed.raw(0x2b2d31)
    .setTitle(`Admin Status: ${target.username}`)
    .setDescription(`<@${target.id}>`)
    .addFields(
      { name: 'Wallet', value: fmt(user.balance), inline: true },
      { name: 'Bank', value: fmt(user.bank), inline: true },
      { name: 'Chips', value: user.chips.toLocaleString(), inline: true },
      { name: 'Frozen', value: user.moderation?.frozen ? 'Yes' : 'No', inline: true },
      { name: 'Global Ban', value: user.moderation?.globallyBanned ? 'Yes' : 'No', inline: true },
      { name: 'Inventory', value: `${(user.inventory || []).length} stack(s)`, inline: true }
    );
}

async function buildAuditEmbed(guildId, limit) {
  const safeLimit = Math.min(Math.max(limit || 5, 1), 10);
  const logs = await AuditLog.find({ guildId }).sort({ createdAt: -1 }).limit(safeLimit);

  if (!logs.length) {
    return embed.info('Audit Log', 'No audit entries have been recorded for this server yet.');
  }

  const auditEmbed = embed.raw(0x2b2d31)
    .setTitle('Recent Audit Log')
    .setDescription(logs.map(log => {
      const amountText = log.amount != null ? ` | ${log.amount}${log.currency ? ` ${log.currency}` : ''}` : '';
      return `**${log.action}** | actor: ${log.actorId || 'n/a'} | target: ${log.targetId || 'n/a'}${amountText}`;
    }).join('\n'));

  auditEmbed.setFooter({ text: `Showing ${logs.length} most recent audit entries` });
  return auditEmbed;
}

async function handleGive(guildId, actorId, target, amount) {
  const user = await getUser(target.id, guildId);
  user.balance += amount;
  await user.save();
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_give', amount, currency: 'wallet' });
  return embed.success('Done', `Gave ${fmt(amount)} to <@${target.id}>.`);
}

async function handleTake(guildId, actorId, target, amount) {
  const user = await getUser(target.id, guildId);
  user.balance = Math.max(0, user.balance - amount);
  await user.save();
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_take', amount, currency: 'wallet' });
  return embed.success('Done', `Took ${fmt(amount)} from <@${target.id}>.`);
}

async function handleSetField(guildId, actorId, target, field, amount) {
  const updates = { [field]: Math.max(0, amount) };
  await setUserValues(guildId, target.id, updates);
  await logAudit({ guildId, actorId, targetId: target.id, action: `admin_set_${field}`, amount, currency: field });
  const label = field === 'balance' ? 'wallet' : field;
  return embed.success('Value Updated', `Set ${label} for <@${target.id}> to **${Math.max(0, amount).toLocaleString()}**.`);
}

async function handleReset(guildId, actorId, target) {
  await setUserValues(guildId, target.id, { balance: 0, bank: 0, chips: 0 });
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_reset_balances' });
  return embed.success('Done', `Reset wallet, bank, and chips for <@${target.id}>.`);
}

async function handleFreeze(guildId, actorId, target, reason) {
  await setUserValues(guildId, target.id, {
    'moderation.frozen': true,
    'moderation.freezeReason': reason || null,
    'moderation.frozenAt': new Date(),
  });
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_freeze', metadata: { reason: reason || null } });
  return embed.success('Account Frozen', `<@${target.id}> can no longer use economy features.${reason ? `\nReason: ${reason}` : ''}`);
}

async function handleUnfreeze(guildId, actorId, target) {
  await setUserValues(guildId, target.id, {
    'moderation.frozen': false,
    'moderation.freezeReason': null,
    'moderation.frozenAt': null,
  });
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_unfreeze' });
  return embed.success('Account Unfrozen', `<@${target.id}> can use economy features again.`);
}

async function handleFeature(guildId, actorId, featureName, enabled) {
  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { [`features.${featureName}`]: enabled }, $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: 'admin_set_feature', metadata: { featureName, enabled } });
  return embed.success('Feature Updated', `The **${featureName}** feature is now **${enabled ? 'enabled' : 'disabled'}**.`);
}

async function handlePrefix(guildId, actorId, newPrefix) {
  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { prefix: newPrefix }, $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: 'admin_set_prefix', metadata: { prefix: newPrefix } });
  return embed.success('Prefix Updated', `Prefix is now \`${newPrefix}\``);
}

module.exports = {
  name: 'admin',
  aliases: ['adm'],
  description: 'Admin commands for managing the economy.',
  usage: '<give|take|setbalance|setbank|setchips|reset|resetall|setprefix|feature|freeze|unfreeze|status|audit> ...',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin economy commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('give').setDescription('Give a user raqs')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('take').setDescription('Take raqs from a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('setbalance').setDescription('Set a user wallet amount')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Wallet amount').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('setbank').setDescription('Set a user bank amount')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Bank amount').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('setchips').setDescription('Set a user chip amount')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Chip amount').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('reset').setDescription('Reset a user balances')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('setprefix').setDescription('Change the bot prefix')
      .addStringOption(o => o.setName('prefix').setDescription('New prefix').setRequired(true)))
    .addSubcommand(s => s.setName('freeze').setDescription('Freeze a user from economy usage')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Why the user is being frozen').setRequired(false)))
    .addSubcommand(s => s.setName('unfreeze').setDescription('Unfreeze a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('feature').setDescription('Enable or disable a feature in this server')
      .addStringOption(o => o.setName('name').setDescription('Feature name').setRequired(true).addChoices(...FEATURE_CHOICES))
      .addBooleanOption(o => o.setName('enabled').setDescription('Whether the feature should be enabled').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('Inspect a user account state')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('audit').setDescription('View recent audit entries')
      .addIntegerOption(o => o.setName('count').setDescription('How many entries to show').setRequired(false).setMinValue(1).setMaxValue(10)))
    .addSubcommand(s => s.setName('resetall').setDescription('Reset all balances in this server')),

  async execute({ message, args }) {
    const sub = args[0]?.toLowerCase();
    const guildId = message.guild.id;
    const actorId = message.author.id;
    const target = parseMentionTarget(message);
    const amount = parseInt(args[2], 10);

    if (sub === 'give') {
      if (!target || isNaN(amount)) return message.reply({ embeds: [embed.error('Usage: `.admin give @user <amount>`')] });
      return message.reply({ embeds: [await handleGive(guildId, actorId, target, amount)] });
    }

    if (sub === 'take') {
      if (!target || isNaN(amount)) return message.reply({ embeds: [embed.error('Usage: `.admin take @user <amount>`')] });
      return message.reply({ embeds: [await handleTake(guildId, actorId, target, amount)] });
    }

    if (sub === 'setbalance') {
      if (!target || isNaN(amount)) return message.reply({ embeds: [embed.error('Usage: `.admin setbalance @user <amount>`')] });
      return message.reply({ embeds: [await handleSetField(guildId, actorId, target, 'balance', amount)] });
    }

    if (sub === 'setbank') {
      if (!target || isNaN(amount)) return message.reply({ embeds: [embed.error('Usage: `.admin setbank @user <amount>`')] });
      return message.reply({ embeds: [await handleSetField(guildId, actorId, target, 'bank', amount)] });
    }

    if (sub === 'setchips') {
      if (!target || isNaN(amount)) return message.reply({ embeds: [embed.error('Usage: `.admin setchips @user <amount>`')] });
      return message.reply({ embeds: [await handleSetField(guildId, actorId, target, 'chips', amount)] });
    }

    if (sub === 'reset') {
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.admin reset @user`')] });
      return message.reply({ embeds: [await handleReset(guildId, actorId, target)] });
    }

    if (sub === 'setprefix') {
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) return message.reply({ embeds: [embed.error('Prefix must be 1-5 characters.')] });
      return message.reply({ embeds: [await handlePrefix(guildId, actorId, newPrefix)] });
    }

    if (sub === 'freeze') {
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.admin freeze @user [reason]`')] });
      const reason = args.slice(2).join(' ').trim();
      return message.reply({ embeds: [await handleFreeze(guildId, actorId, target, reason)] });
    }

    if (sub === 'unfreeze') {
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.admin unfreeze @user`')] });
      return message.reply({ embeds: [await handleUnfreeze(guildId, actorId, target)] });
    }

    if (sub === 'feature') {
      const featureName = args[1]?.toLowerCase();
      const state = args[2]?.toLowerCase();
      if (!['casino', 'heist', 'blackmarket'].includes(featureName) || !['on', 'off', 'true', 'false', 'enable', 'disable'].includes(state)) {
        return message.reply({ embeds: [embed.error('Usage: `.admin feature <casino|heist|blackmarket> <on|off>`')] });
      }
      return message.reply({ embeds: [await handleFeature(guildId, actorId, featureName, ['on', 'true', 'enable'].includes(state))] });
    }

    if (sub === 'status') {
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.admin status @user`')] });
      return message.reply({ embeds: [await buildStatusEmbed(guildId, target)] });
    }

    if (sub === 'audit') {
      const count = parseInt(args[1], 10) || 5;
      return message.reply({ embeds: [await buildAuditEmbed(guildId, count)] });
    }

    if (sub === 'resetall') {
      await User.updateMany({ guildId }, { $set: { balance: 0, bank: 0, chips: 0 } });
      await logAudit({ guildId, actorId, action: 'admin_reset_all' });
      return message.reply({ embeds: [embed.success('Done', 'All wallet, bank, and chip balances in this server have been reset.')] });
    }

    return message.reply({ embeds: [embed.error('Unknown subcommand. Use give, take, setbalance, setbank, setchips, reset, setprefix, feature, freeze, unfreeze, status, audit, or resetall.')] });
  },

  async executeSlash({ interaction }) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const actorId = interaction.user.id;

    if (sub === 'give') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      return interaction.reply({ embeds: [await handleGive(guildId, actorId, target, amount)], ephemeral: true });
    }

    if (sub === 'take') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      return interaction.reply({ embeds: [await handleTake(guildId, actorId, target, amount)], ephemeral: true });
    }

    if (sub === 'setbalance') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      return interaction.reply({ embeds: [await handleSetField(guildId, actorId, target, 'balance', amount)], ephemeral: true });
    }

    if (sub === 'setbank') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      return interaction.reply({ embeds: [await handleSetField(guildId, actorId, target, 'bank', amount)], ephemeral: true });
    }

    if (sub === 'setchips') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      return interaction.reply({ embeds: [await handleSetField(guildId, actorId, target, 'chips', amount)], ephemeral: true });
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      return interaction.reply({ embeds: [await handleReset(guildId, actorId, target)], ephemeral: true });
    }

    if (sub === 'setprefix') {
      const newPrefix = interaction.options.getString('prefix');
      if (newPrefix.length > 5) return interaction.reply({ embeds: [embed.error('Prefix must be 1-5 characters.')], ephemeral: true });
      return interaction.reply({ embeds: [await handlePrefix(guildId, actorId, newPrefix)], ephemeral: true });
    }

    if (sub === 'freeze') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      return interaction.reply({ embeds: [await handleFreeze(guildId, actorId, target, reason)], ephemeral: true });
    }

    if (sub === 'unfreeze') {
      const target = interaction.options.getUser('user');
      return interaction.reply({ embeds: [await handleUnfreeze(guildId, actorId, target)], ephemeral: true });
    }

    if (sub === 'feature') {
      const featureName = interaction.options.getString('name');
      const enabled = interaction.options.getBoolean('enabled');
      return interaction.reply({ embeds: [await handleFeature(guildId, actorId, featureName, enabled)], ephemeral: true });
    }

    if (sub === 'status') {
      const target = interaction.options.getUser('user');
      return interaction.reply({ embeds: [await buildStatusEmbed(guildId, target)], ephemeral: true });
    }

    if (sub === 'audit') {
      const count = interaction.options.getInteger('count') || 5;
      return interaction.reply({ embeds: [await buildAuditEmbed(guildId, count)], ephemeral: true });
    }

    if (sub === 'resetall') {
      await User.updateMany({ guildId }, { $set: { balance: 0, bank: 0, chips: 0 } });
      await logAudit({ guildId, actorId, action: 'admin_reset_all' });
      return interaction.reply({ embeds: [embed.success('Done', 'All wallet, bank, and chip balances in this server have been reset.')], ephemeral: true });
    }
  },
};

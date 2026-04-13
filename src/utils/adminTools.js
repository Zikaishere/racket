const embed = require('./embed');
const { getUser, fmt } = require('./economy');
const Guild = require('../models/Guild');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logAudit } = require('./audit');

const FEATURE_CHOICES = [
  { name: 'Casino', value: 'casino' },
  { name: 'Heist', value: 'heist' },
  { name: 'Black Market', value: 'blackmarket' },
];

const ADMIN_OVERVIEW_COMMANDS = [
  'give @user <amount>',
  'take @user <amount>',
  'setwallet @user <amount>',
  'setbank @user <amount>',
  'setchips @user <amount>',
  'resetuser @user',
  'resetall',
  'freeze @user [reason]',
  'unfreeze @user',
  'adminstatus @user',
  'auditlog [count]',
];

function parseMentionTarget(message) {
  return message.mentions.users.first();
}

async function setUserValues(guildId, targetId, updates) {
  return User.findOneAndUpdate(
    { userId: targetId, guildId },
    { $set: updates, $setOnInsert: { userId: targetId, guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function buildStatusEmbed(guildId, target) {
  const user = await getUser(target.id, guildId);
  return embed
    .raw(0x2b2d31)
    .setTitle(`Admin Status: ${target.username}`)
    .setDescription(`<@${target.id}>`)
    .addFields(
      { name: 'Wallet', value: fmt(user.wallet), inline: true },
      { name: 'Bank', value: fmt(user.bank), inline: true },
      { name: 'Chips', value: user.chips.toLocaleString(), inline: true },
      { name: 'Frozen', value: user.moderation?.frozen ? 'Yes' : 'No', inline: true },
      { name: 'Global Ban', value: user.moderation?.globallyBanned ? 'Yes' : 'No', inline: true },
      { name: 'Inventory', value: `${(user.inventory || []).length} stack(s)`, inline: true },
    );
}

async function buildAuditEmbed(guildId, limit) {
  const safeLimit = Math.min(Math.max(limit || 5, 1), 10);
  const logs = await AuditLog.find({ guildId }).sort({ createdAt: -1 }).limit(safeLimit);

  if (!logs.length) {
    return embed.info('Audit Log', 'No audit entries have been recorded for this server yet.');
  }

  const auditEmbed = embed
    .raw(0x2b2d31)
    .setTitle('Recent Audit Log')
    .setDescription(
      logs
        .map((log) => {
          const amountText = log.amount != null ? ` | ${log.amount}${log.currency ? ` ${log.currency}` : ''}` : '';
          return `**${log.action}** | actor: ${log.actorId || 'n/a'} | target: ${log.targetId || 'n/a'}${amountText}`;
        })
        .join('\n'),
    );

  auditEmbed.setFooter({ text: `Showing ${logs.length} most recent audit entries` });
  return auditEmbed;
}

async function handleGive(guildId, actorId, target, amount) {
  const user = await getUser(target.id, guildId);
  user.wallet += amount;
  user.balance = user.wallet;
  await user.save();
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_give', amount, currency: 'wallet' });
  return embed.success('Done', `Gave ${fmt(amount)} to <@${target.id}>.`);
}

async function handleTake(guildId, actorId, target, amount) {
  const user = await getUser(target.id, guildId);
  user.wallet = Math.max(0, user.wallet - amount);
  user.balance = user.wallet;
  await user.save();
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_take', amount, currency: 'wallet' });
  return embed.success('Done', `Took ${fmt(amount)} from <@${target.id}>.`);
}

async function handleSetField(guildId, actorId, target, field, amount) {
  const safeAmount = Math.max(0, amount);
  await setUserValues(guildId, target.id, { [field]: safeAmount });
  await logAudit({
    guildId,
    actorId,
    targetId: target.id,
    action: `admin_set_${field}`,
    amount: safeAmount,
    currency: field,
  });
  const label = field === 'wallet' ? 'wallet' : field;
  return embed.success('Value Updated', `Set ${label} for <@${target.id}> to **${safeAmount.toLocaleString()}**.`);
}

async function handleReset(guildId, actorId, target) {
  await setUserValues(guildId, target.id, { wallet: 0, balance: 0, bank: 0, chips: 0 });
  await logAudit({ guildId, actorId, targetId: target.id, action: 'admin_reset_balances' });
  return embed.success('Done', `Reset wallet, bank, and chips for <@${target.id}>.`);
}

async function handleResetAll(guildId, actorId) {
  await User.updateMany({ guildId }, { $set: { wallet: 0, balance: 0, bank: 0, chips: 0 } });
  await logAudit({ guildId, actorId, action: 'admin_reset_all' });
  return embed.success('Done', 'All wallet, bank, and chip balances in this server have been reset.');
}

async function handleFreeze(guildId, actorId, target, reason) {
  await setUserValues(guildId, target.id, {
    'moderation.frozen': true,
    'moderation.freezeReason': reason || null,
    'moderation.frozenAt': new Date(),
  });
  await logAudit({
    guildId,
    actorId,
    targetId: target.id,
    action: 'admin_freeze',
    metadata: { reason: reason || null },
  });
  return embed.success(
    'Account Frozen',
    `<@${target.id}> can no longer use economy features.${reason ? `\nReason: ${reason}` : ''}`,
  );
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
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await logAudit({ guildId, actorId, action: 'admin_set_feature', metadata: { featureName, enabled } });
  return embed.success(
    'Feature Updated',
    `The **${featureName}** feature is now **${enabled ? 'enabled' : 'disabled'}**.`,
  );
}

function buildAdminOverviewEmbed(prefix) {
  return embed
    .raw(0x2b2d31)
    .setTitle('Admin Commands')
    .setDescription('These are now standalone admin commands instead of crowded subcommands.')
    .addFields(
      {
        name: 'Available Commands',
        value: ADMIN_OVERVIEW_COMMANDS.map((line) => `\`${prefix}${line}\``).join('\n'),
        inline: false,
      },
      { name: 'Who Can Use These?', value: 'Discord Administrators and configured admin roles.', inline: false },
    );
}

module.exports = {
  FEATURE_CHOICES,
  parseMentionTarget,
  buildStatusEmbed,
  buildAuditEmbed,
  handleGive,
  handleTake,
  handleSetField,
  handleReset,
  handleResetAll,
  handleFreeze,
  handleUnfreeze,
  handleFeature,
  buildAdminOverviewEmbed,
};

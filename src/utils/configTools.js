const embed = require('./embed');
const Guild = require('../models/Guild');
const { DEFAULT_PREFIX, DAILY_COOLDOWN } = require('../config');
const { buildSetupEmbed } = require('./setupMessage');
const { logAudit } = require('./audit');
const {
  COOLDOWN_KEYS,
  COOLDOWN_FIELD_BY_KEY,
  DEFAULT_COOLDOWNS_MS,
  COOLDOWN_LIMITS_MINUTES,
  normalizeCooldownKey,
  getGuildCooldownMs,
  formatCooldown,
  cooldownOverrideStatus,
} = require('./guildCooldowns');

const FEATURE_CHOICES = [
  { name: 'Casino', value: 'casino' },
  { name: 'Heist', value: 'heist' },
  { name: 'Black Market', value: 'blackmarket' },
];

const COOLDOWN_CHOICES = [
  { name: 'Work', value: 'work' },
  { name: 'Rob', value: 'rob' },
  { name: 'Heist (base)', value: 'heist' },
];

const CONFIG_CATEGORY_CHOICES = [
  { name: 'All', value: 'all' },
  { name: 'Economy', value: 'economy' },
  { name: 'Casino', value: 'casino' },
  { name: 'Heist', value: 'heist' },
  { name: 'Black Market', value: 'blackmarket' },
  { name: 'Info', value: 'info' },
  { name: 'Admin', value: 'admin' },
  { name: 'Config', value: 'config' },
];

const PROTECTED_COMMANDS = new Set([
  'help',
  'config',
  'config-setup',
  'onboarding',
]);

function resolveCommand(client, name) {
  if (!name) return null;
  return client.commands.get(name) || client.commands.get(client.aliases.get(name));
}

function canToggleCommand(command) {
  if (!command) return { ok: false, reason: 'That command was not found.' };
  if (command.devOnly) return { ok: false, reason: 'Dev-only commands cannot be configured by server admins.' };
  if (PROTECTED_COMMANDS.has(command.name))
    return { ok: false, reason: `The \`${command.name}\` command cannot be disabled.` };
  return { ok: true };
}

async function getGuildConfig(guildId) {
  return Guild.findOrCreate(guildId);
}

function buildStatusEmbed(guildData) {
  const disabledCommands = (guildData.disabledCommands || []).sort();
  const adminRoles = (guildData.adminRoles || []).map((roleId) => `<@&${roleId}>`);
  const prefix = guildData.prefix || DEFAULT_PREFIX;
  const enabledFeatures = [
    guildData.features?.casino === false ? null : 'casino',
    guildData.features?.heist === false ? null : 'heist',
    guildData.features?.blackmarket === false ? null : 'blackmarket',
  ].filter(Boolean);
  const workCd = getGuildCooldownMs(guildData, 'work');
  const robCd = getGuildCooldownMs(guildData, 'rob');
  const heistCd = getGuildCooldownMs(guildData, 'heist');
  const cooldownLines = [
    `Daily: \`${formatCooldown(DAILY_COOLDOWN)}\` (fixed)`,
    `Work: \`${formatCooldown(workCd)}\` (${cooldownOverrideStatus(guildData, 'work')})`,
    `Rob: \`${formatCooldown(robCd)}\` (${cooldownOverrideStatus(guildData, 'rob')})`,
    `Heist Base: \`${formatCooldown(heistCd)}\` (${cooldownOverrideStatus(guildData, 'heist')})`,
  ];

  return embed
    .raw(0x2b2d31)
    .setTitle('Server Config')
    .setDescription('Setup and configuration are now split into dedicated commands for quicker server setup.')
    .addFields(
      { name: 'Prefix', value: `\`${prefix}\``, inline: true },
      { name: 'Casino', value: guildData.features?.casino === false ? 'Off' : 'On', inline: true },
      { name: 'Heist', value: guildData.features?.heist === false ? 'Off' : 'On', inline: true },
      { name: 'Black Market', value: guildData.features?.blackmarket === false ? 'Off' : 'On', inline: true },
      { name: 'Enabled Feature Count', value: `${enabledFeatures.length}/3`, inline: true },
      { name: 'Disabled Command Count', value: `${disabledCommands.length}`, inline: true },
      {
        name: 'Admin Roles',
        value: adminRoles.length ? adminRoles.join(', ') : 'Discord Administrators only',
        inline: false,
      },
      {
        name: 'Disabled Commands',
        value: disabledCommands.length ? disabledCommands.map((name) => `\`${name}\``).join(', ') : 'None',
        inline: false,
      },
      {
        name: 'Cooldowns',
        value: cooldownLines.join('\n'),
        inline: false,
      },
      {
        name: 'Quick Setup',
        value: `\`${prefix}config-setup\`\n\`${prefix}config prefix <newPrefix>\`\n\`${prefix}config adminrole <@Role> add\`\n\`/config view\``,
        inline: false,
      },
    );
}

function buildCommandsEmbed(client, guildData, category = 'all') {
  const disabled = new Set(guildData.disabledCommands || []);
  const commands = [...client.commands.values()]
    .filter((command) => !command.devOnly)
    .filter((command) => (category === 'all' ? true : command.category === category))
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

  const lines = commands.map((command) => {
    const locked = PROTECTED_COMMANDS.has(command.name);
    const state = locked ? 'locked' : disabled.has(command.name) ? 'off' : 'on';
    return `\`${command.name}\` - ${state} (${command.category})`;
  });

  return embed
    .raw(0x2b2d31)
    .setTitle(category === 'all' ? 'Configurable Commands' : `Configurable Commands: ${category}`)
    .setDescription(lines.join('\n') || 'No commands found for that category.')
    .setFooter({ text: `Total shown: ${commands.length}` });
}

async function postSetupGuide(channel, prefix) {
  if (!channel?.send) {
    throw new Error('No sendable channel was available for the setup guide.');
  }
  await channel.send({ embeds: [buildSetupEmbed(prefix || DEFAULT_PREFIX)] });
}

async function setPrefix(guildId, actorId, prefix) {
  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { prefix }, $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await logAudit({ guildId, actorId, action: 'config_set_prefix', metadata: { prefix } });
  return embed.success('Config Updated', `Prefix is now \`${prefix}\`.`);
}

async function setFeature(guildId, actorId, featureName, enabled) {
  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { [`features.${featureName}`]: enabled }, $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await logAudit({ guildId, actorId, action: 'config_set_feature', metadata: { featureName, enabled } });
  return embed.success(
    'Config Updated',
    `The **${featureName}** feature is now **${enabled ? 'enabled' : 'disabled'}**.`,
  );
}

async function setCommandState(guildId, actorId, client, commandName, enabled) {
  const command = resolveCommand(client, commandName.toLowerCase());
  const validation = canToggleCommand(command);
  if (!validation.ok) return embed.error(validation.reason);

  const update = enabled
    ? { $pull: { disabledCommands: command.name }, $setOnInsert: { guildId } }
    : { $addToSet: { disabledCommands: command.name }, $setOnInsert: { guildId } };

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  await logAudit({ guildId, actorId, action: 'config_set_command', metadata: { command: command.name, enabled } });
  return embed.success(
    'Config Updated',
    `The \`${command.name}\` command is now **${enabled ? 'enabled' : 'disabled'}**.`,
  );
}

async function setAdminRole(guildId, actorId, roleId, action) {
  const update =
    action === 'add'
      ? { $addToSet: { adminRoles: roleId }, $setOnInsert: { guildId } }
      : { $pull: { adminRoles: roleId }, $setOnInsert: { guildId } };

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  await logAudit({ guildId, actorId, action: `config_adminrole_${action}`, metadata: { roleId } });
  return embed.success(
    'Config Updated',
    `${action === 'add' ? 'Added' : 'Removed'} <@&${roleId}> ${action === 'add' ? 'as' : 'from'} config/admin access.`,
  );
}

function validateCooldownValue(key, minutes) {
  const normalized = normalizeCooldownKey(key);
  if (!normalized) return { ok: false, error: 'Invalid cooldown type. Use work, rob, or heist.' };
  const parsed = Number(minutes);
  if (!Number.isInteger(parsed)) return { ok: false, error: 'Cooldown minutes must be a whole number.' };
  const limits = COOLDOWN_LIMITS_MINUTES[normalized];
  if (parsed < limits.min || parsed > limits.max) {
    return {
      ok: false,
      error: `${normalized} cooldown must be between ${limits.min} and ${limits.max} minutes.`,
    };
  }
  return { ok: true, key: normalized, minutes: parsed };
}

async function setCooldown(guildId, actorId, cooldownKey, minutes) {
  const validation = validateCooldownValue(cooldownKey, minutes);
  if (!validation.ok) return embed.error(validation.error);

  const field = COOLDOWN_FIELD_BY_KEY[validation.key];
  const ms = validation.minutes * 60000;
  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { [`cooldowns.${field}`]: ms }, $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await logAudit({
    guildId,
    actorId,
    action: 'config_set_cooldown',
    metadata: { cooldown: validation.key, minutes: validation.minutes },
  });
  return embed.success(
    'Config Updated',
    `${validation.key} cooldown is now **${formatCooldown(ms)}** for this server.`,
  );
}

async function resetCooldown(guildId, actorId, cooldownKey = 'all') {
  const normalized = `${cooldownKey || 'all'}`.toLowerCase();
  const update =
    normalized === 'all'
      ? {
          $set: {
            'cooldowns.workMs': null,
            'cooldowns.robMs': null,
            'cooldowns.heistBaseMs': null,
          },
          $setOnInsert: { guildId },
        }
      : null;

  if (!update) {
    const key = normalizeCooldownKey(normalized);
    if (!key) return embed.error('Invalid cooldown type. Use work, rob, heist, or all.');
    const field = COOLDOWN_FIELD_BY_KEY[key];
    await Guild.findOneAndUpdate(
      { guildId },
      { $set: { [`cooldowns.${field}`]: null }, $setOnInsert: { guildId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await logAudit({
      guildId,
      actorId,
      action: 'config_reset_cooldown',
      metadata: { cooldown: key },
    });
    return embed.success(
      'Config Updated',
      `${key} cooldown reverted to default (${formatCooldown(DEFAULT_COOLDOWNS_MS[key])}).`,
    );
  }

  await Guild.findOneAndUpdate({ guildId }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  await logAudit({
    guildId,
    actorId,
    action: 'config_reset_cooldown',
    metadata: { cooldown: 'all' },
  });
  return embed.success('Config Updated', 'All customizable cooldowns were reset to defaults.');
}

function buildCooldownStatusEmbed(guildData) {
  const workCd = getGuildCooldownMs(guildData, 'work');
  const robCd = getGuildCooldownMs(guildData, 'rob');
  const heistCd = getGuildCooldownMs(guildData, 'heist');
  return embed
    .raw(0x2b2d31)
    .setTitle('Server Cooldowns')
    .setDescription(
      [
        `Daily: \`${formatCooldown(DAILY_COOLDOWN)}\` (fixed)`,
        `Work: \`${formatCooldown(workCd)}\` (${cooldownOverrideStatus(guildData, 'work')})`,
        `Rob: \`${formatCooldown(robCd)}\` (${cooldownOverrideStatus(guildData, 'rob')})`,
        `Heist Base: \`${formatCooldown(heistCd)}\` (${cooldownOverrideStatus(guildData, 'heist')})`,
        '',
        'Use `.config cooldown set <work|rob|heist> <minutes>` to customize.',
      ].join('\n'),
    );
}

async function resetConfig(guildId, actorId) {
  await Guild.findOneAndUpdate(
    { guildId },
    {
      $set: {
        prefix: DEFAULT_PREFIX,
        'features.casino': true,
        'features.heist': true,
        'features.blackmarket': true,
        adminRoles: [],
        disabledCommands: [],
        'cooldowns.workMs': null,
        'cooldowns.robMs': null,
        'cooldowns.heistBaseMs': null,
      },
      $setOnInsert: { guildId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await logAudit({ guildId, actorId, action: 'config_reset' });
  return embed.success(
    'Config Reset',
    'Prefix, feature toggles, admin roles, disabled commands, and cooldown overrides were reset to defaults.',
  );
}

function buildConfigOverviewEmbed(prefix) {
  return embed
    .raw(0x2b2d31)
    .setTitle('Config Commands')
    .setDescription('Configuration has been split into direct commands so server owners can set things up faster.')
    .addFields(
      {
        name: 'Setup',
        value: `\`${prefix}config-setup\`\n\`/config view\``,
        inline: true,
      },
      {
        name: 'Toggles',
        value: `\`${prefix}config feature <feature> <on|off>\`\n\`${prefix}config command <command> <on|off>\``,
        inline: true,
      },
      {
        name: 'Server Settings',
        value: `\`${prefix}config prefix <newPrefix>\`\n\`${prefix}config adminrole <add|remove> <@Role>\`\n\`${prefix}config cooldown view\``,
        inline: true,
      },
    );
}

module.exports = {
  FEATURE_CHOICES,
  COOLDOWN_CHOICES,
  COOLDOWN_KEYS,
  CONFIG_CATEGORY_CHOICES,
  PROTECTED_COMMANDS,
  resolveCommand,
  canToggleCommand,
  getGuildConfig,
  buildStatusEmbed,
  buildCommandsEmbed,
  postSetupGuide,
  setPrefix,
  setFeature,
  setCommandState,
  setAdminRole,
  setCooldown,
  resetCooldown,
  resetConfig,
  buildCooldownStatusEmbed,
  buildConfigOverviewEmbed,
};

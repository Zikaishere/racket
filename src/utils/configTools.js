const embed = require('./embed');
const Guild = require('../models/Guild');
const { DEFAULT_PREFIX } = require('../config');
const { buildSetupEmbed } = require('./setupMessage');
const { logAudit } = require('./audit');

const FEATURE_CHOICES = [
  { name: 'Casino', value: 'casino' },
  { name: 'Heist', value: 'heist' },
  { name: 'Black Market', value: 'blackmarket' },
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
  'configstatus',
  'configsetup',
  'setuphere',
  'configcommands',
  'setprefix',
  'togglefeature',
  'togglecommand',
  'adminrole',
  'resetconfig',
]);

function resolveCommand(client, name) {
  if (!name) return null;
  return client.commands.get(name) || client.commands.get(client.aliases.get(name));
}

function canToggleCommand(command) {
  if (!command) return { ok: false, reason: 'That command was not found.' };
  if (command.devOnly) return { ok: false, reason: 'Dev-only commands cannot be configured by server admins.' };
  if (PROTECTED_COMMANDS.has(command.name)) return { ok: false, reason: `The \`${command.name}\` command cannot be disabled.` };
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

  return embed.raw(0x2b2d31)
    .setTitle('Server Config')
    .setDescription('Setup and configuration are now split into dedicated commands for quicker server setup.')
    .addFields(
      { name: 'Prefix', value: `\`${prefix}\``, inline: true },
      { name: 'Casino', value: guildData.features?.casino === false ? 'Off' : 'On', inline: true },
      { name: 'Heist', value: guildData.features?.heist === false ? 'Off' : 'On', inline: true },
      { name: 'Black Market', value: guildData.features?.blackmarket === false ? 'Off' : 'On', inline: true },
      { name: 'Enabled Feature Count', value: `${enabledFeatures.length}/3`, inline: true },
      { name: 'Disabled Command Count', value: `${disabledCommands.length}`, inline: true },
      { name: 'Admin Roles', value: adminRoles.length ? adminRoles.join(', ') : 'Discord Administrators only', inline: false },
      { name: 'Disabled Commands', value: disabledCommands.length ? disabledCommands.map((name) => `\`${name}\``).join(', ') : 'None', inline: false },
      { name: 'Quick Setup', value: `\`${prefix}configsetup\`\n\`${prefix}setprefix <newPrefix>\`\n\`${prefix}adminrole add @Role\`\n\`${prefix}configcommands\``, inline: false },
    );
}

function buildCommandsEmbed(client, guildData, category = 'all') {
  const disabled = new Set(guildData.disabledCommands || []);
  const commands = [...client.commands.values()]
    .filter((command) => !command.devOnly)
    .filter((command) => category === 'all' ? true : command.category === category)
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

  const lines = commands.map((command) => {
    const locked = PROTECTED_COMMANDS.has(command.name);
    const state = locked ? 'locked' : disabled.has(command.name) ? 'off' : 'on';
    return `\`${command.name}\` - ${state} (${command.category})`;
  });

  return embed.raw(0x2b2d31)
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: 'config_set_prefix', metadata: { prefix } });
  return embed.success('Config Updated', `Prefix is now \`${prefix}\`.`);
}

async function setFeature(guildId, actorId, featureName, enabled) {
  await Guild.findOneAndUpdate(
    { guildId },
    { $set: { [`features.${featureName}`]: enabled }, $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: 'config_set_feature', metadata: { featureName, enabled } });
  return embed.success('Config Updated', `The **${featureName}** feature is now **${enabled ? 'enabled' : 'disabled'}**.`);
}

async function setCommandState(guildId, actorId, client, commandName, enabled) {
  const command = resolveCommand(client, commandName.toLowerCase());
  const validation = canToggleCommand(command);
  if (!validation.ok) return embed.error(validation.reason);

  const update = enabled
    ? { $pull: { disabledCommands: command.name }, $setOnInsert: { guildId } }
    : { $addToSet: { disabledCommands: command.name }, $setOnInsert: { guildId } };

  await Guild.findOneAndUpdate(
    { guildId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: 'config_set_command', metadata: { command: command.name, enabled } });
  return embed.success('Config Updated', `The \`${command.name}\` command is now **${enabled ? 'enabled' : 'disabled'}**.`);
}

async function setAdminRole(guildId, actorId, roleId, action) {
  const update = action === 'add'
    ? { $addToSet: { adminRoles: roleId }, $setOnInsert: { guildId } }
    : { $pull: { adminRoles: roleId }, $setOnInsert: { guildId } };

  await Guild.findOneAndUpdate(
    { guildId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: `config_adminrole_${action}`, metadata: { roleId } });
  return embed.success('Config Updated', `${action === 'add' ? 'Added' : 'Removed'} <@&${roleId}> ${action === 'add' ? 'as' : 'from'} config/admin access.`);
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
      },
      $setOnInsert: { guildId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await logAudit({ guildId, actorId, action: 'config_reset' });
  return embed.success('Config Reset', 'Prefix, feature toggles, admin roles, and disabled commands were reset to defaults.');
}

function buildConfigOverviewEmbed(prefix) {
  return embed.raw(0x2b2d31)
    .setTitle('Config Commands')
    .setDescription('Configuration has been split into direct commands so server owners can set things up faster.')
    .addFields(
      { name: 'Setup', value: `\`${prefix}configsetup\`\n\`${prefix}setuphere\`\n\`${prefix}configstatus\``, inline: true },
      { name: 'Toggles', value: `\`${prefix}togglefeature <feature> <on|off>\`\n\`${prefix}togglecommand <command> <on|off>\`\n\`${prefix}configcommands [category]\``, inline: true },
      { name: 'Server Settings', value: `\`${prefix}setprefix <newPrefix>\`\n\`${prefix}adminrole add @Role\`\n\`${prefix}resetconfig\``, inline: true },
    );
}

module.exports = {
  FEATURE_CHOICES,
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
  resetConfig,
  buildConfigOverviewEmbed,
};

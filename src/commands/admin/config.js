const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const Guild = require('../../models/Guild');
const { DEFAULT_PREFIX } = require('../../config');
const { buildSetupEmbed } = require('../../utils/setupMessage');
const { logAudit } = require('../../utils/audit');

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
];

const PROTECTED_COMMANDS = new Set(['admin', 'config', 'help']);

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
  const adminRoles = (guildData.adminRoles || []).map(roleId => `<@&${roleId}>`);

  return embed.raw(0x2b2d31)
    .setTitle('Server Config')
    .addFields(
      { name: 'Prefix', value: `\`${guildData.prefix || DEFAULT_PREFIX}\``, inline: true },
      { name: 'Casino', value: guildData.features?.casino === false ? 'Off' : 'On', inline: true },
      { name: 'Heist', value: guildData.features?.heist === false ? 'Off' : 'On', inline: true },
      { name: 'Black Market', value: guildData.features?.blackmarket === false ? 'Off' : 'On', inline: true },
      { name: 'Admin Roles', value: adminRoles.length ? adminRoles.join(', ') : 'Discord Administrators only', inline: false },
      { name: 'Disabled Commands', value: disabledCommands.length ? disabledCommands.map(name => `\`${name}\``).join(', ') : 'None', inline: false },
    );
}

function buildCommandsEmbed(client, guildData, category = 'all') {
  const disabled = new Set(guildData.disabledCommands || []);
  const commands = [...client.commands.values()]
    .filter(command => !command.devOnly)
    .filter(command => category === 'all' ? true : command.category === category)
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

  const commandLines = commands.map(command => {
    const locked = PROTECTED_COMMANDS.has(command.name);
    const state = locked ? 'locked' : disabled.has(command.name) ? 'off' : 'on';
    return `\`${command.name}\` - ${state} (${command.category})`;
  });

  return embed.raw(0x2b2d31)
    .setTitle(category === 'all' ? 'Configurable Commands' : `Configurable Commands: ${category}`)
    .setDescription(commandLines.join('\n') || 'No commands found for that category.')
    .setFooter({ text: 'Use .config command <name> <on|off> to change a command state.' });
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

module.exports = {
  name: 'config',
  aliases: ['settings', 'setup'],
  description: 'Configure the bot for this server.',
  usage: '<status|setup|commands|prefix|feature|command|adminrole|reset> ...',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('status').setDescription('View current bot configuration'))
    .addSubcommand(s => s.setName('setup').setDescription('Show setup instructions'))
    .addSubcommand(s => s.setName('commands').setDescription('List toggleable commands')
      .addStringOption(o => o.setName('category').setDescription('Optional category filter').setRequired(false).addChoices(...CONFIG_CATEGORY_CHOICES)))
    .addSubcommand(s => s.setName('prefix').setDescription('Change the bot prefix')
      .addStringOption(o => o.setName('value').setDescription('New prefix').setRequired(true)))
    .addSubcommand(s => s.setName('feature').setDescription('Enable or disable a feature')
      .addStringOption(o => o.setName('name').setDescription('Feature name').setRequired(true).addChoices(...FEATURE_CHOICES))
      .addBooleanOption(o => o.setName('enabled').setDescription('Whether the feature should be enabled').setRequired(true)))
    .addSubcommand(s => s.setName('command').setDescription('Enable or disable an individual command')
      .addStringOption(o => o.setName('name').setDescription('Command or alias').setRequired(true))
      .addBooleanOption(o => o.setName('enabled').setDescription('Whether the command should be enabled').setRequired(true)))
    .addSubcommand(s => s.setName('adminrole').setDescription('Add or remove an admin role')
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role to update').setRequired(true)))
    .addSubcommand(s => s.setName('reset').setDescription('Reset server config to defaults')),

  async execute({ message, args, client, guildData, prefix }) {
    const sub = args[0]?.toLowerCase() || 'status';
    const guildId = message.guild.id;
    const actorId = message.author.id;
    const currentGuildData = guildData || await getGuildConfig(guildId);

    if (sub === 'status') {
      return message.reply({ embeds: [buildStatusEmbed(currentGuildData)] });
    }

    if (sub === 'setup') {
      return message.reply({ embeds: [buildSetupEmbed(prefix || currentGuildData.prefix || DEFAULT_PREFIX)] });
    }

    if (sub === 'commands') {
      const category = args[1]?.toLowerCase() || 'all';
      if (!CONFIG_CATEGORY_CHOICES.some(choice => choice.value === category)) {
        return message.reply({ embeds: [embed.error('Usage: `.config commands [all|economy|casino|heist|blackmarket|info|admin]`')] });
      }
      return message.reply({ embeds: [buildCommandsEmbed(client, currentGuildData, category)] });
    }

    if (sub === 'prefix') {
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) {
        return message.reply({ embeds: [embed.error('Usage: `.config prefix <newPrefix>` and the prefix must be 1-5 characters.')] });
      }
      return message.reply({ embeds: [await setPrefix(guildId, actorId, newPrefix)] });
    }

    if (sub === 'feature') {
      const featureName = args[1]?.toLowerCase();
      const state = args[2]?.toLowerCase();
      if (!['casino', 'heist', 'blackmarket'].includes(featureName) || !['on', 'off', 'true', 'false', 'enable', 'disable'].includes(state)) {
        return message.reply({ embeds: [embed.error('Usage: `.config feature <casino|heist|blackmarket> <on|off>`')] });
      }
      return message.reply({ embeds: [await setFeature(guildId, actorId, featureName, ['on', 'true', 'enable'].includes(state))] });
    }

    if (sub === 'command') {
      const commandName = args[1];
      const state = args[2]?.toLowerCase();
      if (!commandName || !['on', 'off', 'true', 'false', 'enable', 'disable'].includes(state)) {
        return message.reply({ embeds: [embed.error('Usage: `.config command <command> <on|off>`')] });
      }
      return message.reply({ embeds: [await setCommandState(guildId, actorId, client, commandName, ['on', 'true', 'enable'].includes(state))] });
    }

    if (sub === 'adminrole') {
      const action = args[1]?.toLowerCase();
      const role = message.mentions.roles.first();
      if (!['add', 'remove'].includes(action) || !role) {
        return message.reply({ embeds: [embed.error('Usage: `.config adminrole <add|remove> @Role`')] });
      }
      return message.reply({ embeds: [await setAdminRole(guildId, actorId, role.id, action)] });
    }

    if (sub === 'reset') {
      return message.reply({ embeds: [await resetConfig(guildId, actorId)] });
    }

    return message.reply({ embeds: [embed.error('Unknown config subcommand. Use status, setup, commands, prefix, feature, command, adminrole, or reset.')] });
  },

  async executeSlash({ interaction, client, guildData }) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const actorId = interaction.user.id;
    const currentGuildData = guildData || await getGuildConfig(guildId);

    if (sub === 'status') {
      return interaction.reply({ embeds: [buildStatusEmbed(currentGuildData)], ephemeral: true });
    }

    if (sub === 'setup') {
      return interaction.reply({ embeds: [buildSetupEmbed(currentGuildData.prefix || DEFAULT_PREFIX)], ephemeral: true });
    }

    if (sub === 'commands') {
      return interaction.reply({
        embeds: [buildCommandsEmbed(client, currentGuildData, interaction.options.getString('category') || 'all')],
        ephemeral: true,
      });
    }

    if (sub === 'prefix') {
      const value = interaction.options.getString('value');
      if (!value || value.length > 5) {
        return interaction.reply({ embeds: [embed.error('The prefix must be 1-5 characters.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [await setPrefix(guildId, actorId, value)], ephemeral: true });
    }

    if (sub === 'feature') {
      return interaction.reply({
        embeds: [await setFeature(
          guildId,
          actorId,
          interaction.options.getString('name'),
          interaction.options.getBoolean('enabled')
        )],
        ephemeral: true,
      });
    }

    if (sub === 'command') {
      return interaction.reply({
        embeds: [await setCommandState(
          guildId,
          actorId,
          client,
          interaction.options.getString('name'),
          interaction.options.getBoolean('enabled')
        )],
        ephemeral: true,
      });
    }

    if (sub === 'adminrole') {
      return interaction.reply({
        embeds: [await setAdminRole(
          guildId,
          actorId,
          interaction.options.getRole('role').id,
          interaction.options.getString('action')
        )],
        ephemeral: true,
      });
    }

    if (sub === 'reset') {
      return interaction.reply({ embeds: [await resetConfig(guildId, actorId)], ephemeral: true });
    }
  },
};

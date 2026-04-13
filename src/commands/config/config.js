const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { DEFAULT_PREFIX: _DEFAULT_PREFIX } = require('../../config');
const {
  getGuildConfig,
  buildStatusEmbed,
  setPrefix,
  setFeature,
  setCommandState,
  setAdminRole,
  resetConfig,
  FEATURE_CHOICES,
} = require('../../utils/configTools');

module.exports = {
  name: 'config',
  aliases: ['cfg', 'settings'],
  description: 'Manage server configuration settings.',
  usage: '<view|prefix|feature|command|adminrole|reset> [options]',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Manage server configuration settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('view').setDescription('View current configuration status'))
    .addSubcommand((sub) =>
      sub
        .setName('prefix')
        .setDescription('Set the server prefix')
        .addStringOption((opt) => opt.setName('new_prefix').setDescription('The new prefix').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('feature')
        .setDescription('Toggle a feature')
        .addStringOption((opt) =>
          opt
            .setName('feature_name')
            .setDescription('Feature to toggle')
            .setRequired(true)
            .addChoices(...FEATURE_CHOICES),
        )
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable or disable?').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('command')
        .setDescription('Toggle a specific command')
        .addStringOption((opt) => opt.setName('command_name').setDescription('Command to toggle').setRequired(true))
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable or disable?').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('adminrole')
        .setDescription('Add or remove an admin role')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to modify').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove?')
            .setRequired(true)
            .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }),
        ),
    )
    .addSubcommand((sub) => sub.setName('reset').setDescription('Reset entire server configuration to defaults')),

  async execute({ message, args, client, guildData }) {
    if (!args.length)
      return message.reply({
        embeds: [embed.error('Please specify a sub-command (view, prefix, feature, command, adminrole, reset).')],
      });

    const sub = args[0].toLowerCase();
    const currentConfig = guildData || (await getGuildConfig(message.guild.id));

    if (sub === 'view' || sub === 'status') {
      return message.reply({ embeds: [buildStatusEmbed(currentConfig)] });
    }

    if (sub === 'prefix') {
      const newPrefix = args[1];
      if (!newPrefix) return message.reply({ embeds: [embed.error('Please provide a new prefix.')] });
      return message.reply({ embeds: [await setPrefix(message.guild.id, message.author.id, newPrefix)] });
    }

    if (sub === 'feature') {
      const feature = args[1]?.toLowerCase();
      const stateArg = args[2]?.toLowerCase();
      if (!feature || !stateArg)
        return message.reply({ embeds: [embed.error('Usage: `.config feature <casino|heist|blackmarket> <on|off>`')] });

      const enabled = ['on', 'true', 'enable'].includes(stateArg);
      return message.reply({ embeds: [await setFeature(message.guild.id, message.author.id, feature, enabled)] });
    }

    if (sub === 'command') {
      const commandName = args[1]?.toLowerCase();
      const stateArg = args[2]?.toLowerCase();
      if (!commandName || !stateArg)
        return message.reply({ embeds: [embed.error('Usage: `.config command <commandName> <on|off>`')] });

      const enabled = ['on', 'true', 'enable'].includes(stateArg);
      return message.reply({
        embeds: [await setCommandState(message.guild.id, message.author.id, client, commandName, enabled)],
      });
    }

    if (sub === 'adminrole') {
      const roleArg = args[1];
      const action = args[2]?.toLowerCase();
      if (!roleArg || !['add', 'remove'].includes(action))
        return message.reply({ embeds: [embed.error('Usage: `.config adminrole <@role> <add|remove>`')] });

      const roleId = roleArg.replace(/[<@&>]/g, '');
      const role = message.guild.roles.cache.get(roleId);
      if (!role) return message.reply({ embeds: [embed.error('Role not found. Please mention the role.')] });

      return message.reply({ embeds: [await setAdminRole(message.guild.id, message.author.id, role.id, action)] });
    }

    if (sub === 'reset') {
      return message.reply({ embeds: [await resetConfig(message.guild.id, message.author.id)] });
    }

    return message.reply({ embeds: [embed.error(`Unknown subcommand \`${sub}\`.`)] });
  },

  async executeSlash({ interaction, client, guildData }) {
    const sub = interaction.options.getSubcommand();
    const currentConfig = guildData || (await getGuildConfig(interaction.guild.id));

    if (sub === 'view') {
      return interaction.reply({ embeds: [buildStatusEmbed(currentConfig)], ephemeral: true });
    }

    if (sub === 'prefix') {
      const newPrefix = interaction.options.getString('new_prefix');
      return interaction.reply({
        embeds: [await setPrefix(interaction.guild.id, interaction.user.id, newPrefix)],
        ephemeral: true,
      });
    }

    if (sub === 'feature') {
      const feature = interaction.options.getString('feature_name');
      const enabled = interaction.options.getBoolean('enabled');
      return interaction.reply({
        embeds: [await setFeature(interaction.guild.id, interaction.user.id, feature, enabled)],
        ephemeral: true,
      });
    }

    if (sub === 'command') {
      const commandName = interaction.options.getString('command_name');
      const enabled = interaction.options.getBoolean('enabled');
      return interaction.reply({
        embeds: [await setCommandState(interaction.guild.id, interaction.user.id, client, commandName, enabled)],
        ephemeral: true,
      });
    }

    if (sub === 'adminrole') {
      const role = interaction.options.getRole('role');
      const action = interaction.options.getString('action');
      return interaction.reply({
        embeds: [await setAdminRole(interaction.guild.id, interaction.user.id, role.id, action)],
        ephemeral: true,
      });
    }

    if (sub === 'reset') {
      return interaction.reply({
        embeds: [await resetConfig(interaction.guild.id, interaction.user.id)],
        ephemeral: true,
      });
    }
  },
};

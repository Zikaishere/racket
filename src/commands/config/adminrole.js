const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { setAdminRole } = require('../../utils/configTools');

module.exports = {
  name: 'adminrole',
  aliases: ['configrole'],
  description: 'Add or remove an admin role for bot management.',
  usage: '<add|remove> @Role',
  category: 'config',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('adminrole')
    .setDescription('Add or remove an admin role')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('Add or remove')
        .setRequired(true)
        .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }),
    )
    .addRoleOption((option) => option.setName('role').setDescription('Role to update').setRequired(true)),

  async execute({ message, args }) {
    const action = args[0]?.toLowerCase();
    const role = message.mentions.roles.first();
    if (!['add', 'remove'].includes(action) || !role) {
      return message.reply({ embeds: [embed.error('Usage: `.adminrole <add|remove> @Role`')] });
    }
    return message.reply({ embeds: [await setAdminRole(message.guild.id, message.author.id, role.id, action)] });
  },

  async executeSlash({ interaction }) {
    return interaction.reply({
      embeds: [
        await setAdminRole(
          interaction.guild.id,
          interaction.user.id,
          interaction.options.getRole('role').id,
          interaction.options.getString('action'),
        ),
      ],
      ephemeral: true,
    });
  },
};

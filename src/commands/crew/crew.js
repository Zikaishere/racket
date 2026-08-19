const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const Crew = require('../../models/Crew');
const { logAudit } = require('../../utils/audit');

const MAX_CREW_SIZE = 8;

async function findCrewByMember(guildId, userId) {
  return Crew.findOne({ guildId, members: userId });
}

function buildCrewEmbed(crew) {
  const stats = crew.stats || {};
  const winRate = (stats.heistsWon || 0) + (stats.heistsLost || 0) > 0
    ? `${Math.round(((stats.heistsWon || 0) / ((stats.heistsWon || 0) + (stats.heistsLost || 0))) * 100)}%`
    : 'N/A';

  const e = embed
    .raw(0x2b2d31)
    .setTitle(`${crew.name}`)
    .setDescription(crew.description || 'No description set.');

  if (crew.tag) e.setAuthor({ name: crew.tag });

  e.addFields(
    { name: 'Leader', value: `<@${crew.leaderId}>`, inline: true },
    { name: 'Members', value: `${crew.members.length}/${MAX_CREW_SIZE}`, inline: true },
    { name: 'Win Rate', value: winRate, inline: true },
    { name: 'Roster', value: crew.members.map((id) => `<@${id}>`).join(', ') || 'Empty', inline: false },
  );

  if (crew.invites.length) {
    e.addFields({ name: 'Pending Invites', value: crew.invites.map((id) => `<@${id}>`).join(', '), inline: false });
  }

  return e;
}

function buildListEmbed(crews) {
  const lines = crews.map((crew, i) => {
    const stats = crew.stats || {};
    const wins = stats.heistsWon || 0;
    const losses = stats.heistsLost || 0;
    return `**${i + 1}.** ${crew.name} — <@${crew.leaderId}> — ${crew.members.length}/${MAX_CREW_SIZE} — ${wins}W/${losses}L`;
  });

  return embed.raw(0x2b2d31).setTitle('Crews').setDescription(lines.join('\n'));
}

module.exports = {
  name: 'crew',
  aliases: ['gang'],
  description: 'Create and manage a permanent crew.',
  usage: '<create|invite|join|leave|kick|disband|tag|describe|info|list> ...',
  category: 'heist',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('crew')
    .setDescription('Manage a permanent crew')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a new crew').addStringOption((o) => o.setName('name').setDescription('Crew name (1-30 chars)').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('invite').setDescription('Invite a user').addUserOption((o) => o.setName('user').setDescription('User to invite').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('join').setDescription('Join a crew you were invited to').addStringOption((o) => o.setName('name').setDescription('Crew name').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('leave').setDescription('Leave your current crew'))
    .addSubcommand((s) =>
      s.setName('kick').setDescription('Kick a member').addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('disband').setDescription('Disband your crew'))
    .addSubcommand((s) =>
      s.setName('tag').setDescription('Set crew tag').addStringOption((o) => o.setName('tag').setDescription('Short tag (max 10 chars)').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('describe').setDescription('Set crew description').addStringOption((o) => o.setName('text').setDescription('Description (max 120 chars)').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('info').setDescription('View a crew').addStringOption((o) => o.setName('name').setDescription('Crew name').setRequired(false)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('List all crews')),

  async execute({ message, args }) {
    const sub = (args[0] || 'info').toLowerCase();
    const guildId = message.guild.id;
    const userId = message.author.id;

    if (sub === 'create') {
      const name = args.slice(1).join(' ').trim();
      if (!name || name.length > 30) return message.reply({ embeds: [embed.error('Usage: `.crew create <name>` (1-30 characters).')] });
      if (await findCrewByMember(guildId, userId)) return message.reply({ embeds: [embed.error('You are already in a crew. Leave it first.')] });
      const existing = await Crew.findOne({ guildId, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (existing) return message.reply({ embeds: [embed.error('A crew with that name already exists.')] });
      const crew = await Crew.create({ guildId, name, leaderId: userId, members: [userId], invites: [] });
      await logAudit({ guildId, actorId: userId, action: 'crew_create', metadata: { crewName: name } });
      return message.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'invite') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.crew invite @user`')] });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return message.reply({ embeds: [embed.error('Only the crew leader can invite.')] });
      if (crew.members.length >= MAX_CREW_SIZE) return message.reply({ embeds: [embed.error('Your crew is full.')] });
      if (await findCrewByMember(guildId, target.id)) return message.reply({ embeds: [embed.error('That user is already in a crew.')] });
      if (!crew.invites.includes(target.id)) crew.invites.push(target.id);
      await crew.save();
      await logAudit({ guildId, actorId: userId, targetId: target.id, action: 'crew_invite', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [embed.success('Invite Sent', `<@${target.id}> can now join **${crew.name}** with \`.crew join ${crew.name}\``)] });
    }

    if (sub === 'join') {
      const crewName = args.slice(1).join(' ').trim();
      if (!crewName) return message.reply({ embeds: [embed.error('Usage: `.crew join <crew-name>`')] });
      if (await findCrewByMember(guildId, userId)) return message.reply({ embeds: [embed.error('You are already in a crew.')] });
      const crew = await Crew.findOne({ guildId, name: new RegExp(`^${crewName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!crew) return message.reply({ embeds: [embed.error('That crew does not exist.')] });
      if (!crew.invites.includes(userId)) return message.reply({ embeds: [embed.error('You were not invited.')] });
      if (crew.members.length >= MAX_CREW_SIZE) return message.reply({ embeds: [embed.error('That crew is full.')] });
      crew.members.push(userId);
      crew.invites = crew.invites.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_join', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'leave') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew) return message.reply({ embeds: [embed.error('You are not in a crew.')] });
      if (crew.leaderId === userId) return message.reply({ embeds: [embed.error('Leaders must `.crew disband` instead.')] });
      crew.members = crew.members.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_leave', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [embed.success('Crew Left', `You left **${crew.name}**.`)] });
    }

    if (sub === 'kick') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.crew kick @user`')] });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return message.reply({ embeds: [embed.error('Only the crew leader can kick.')] });
      if (target.id === userId) return message.reply({ embeds: [embed.error('Use `.crew disband` to dissolve the crew.')] });
      if (!crew.members.includes(target.id)) return message.reply({ embeds: [embed.error('That user is not in your crew.')] });
      crew.members = crew.members.filter((id) => id !== target.id);
      await crew.save();
      await logAudit({ guildId, actorId: userId, targetId: target.id, action: 'crew_kick', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [embed.success('Crew Updated', `<@${target.id}> was removed from **${crew.name}**.`)] });
    }

    if (sub === 'disband') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return message.reply({ embeds: [embed.error('Only the crew leader can disband.')] });
      const name = crew.name;
      await Crew.deleteOne({ _id: crew._id });
      await logAudit({ guildId, actorId: userId, action: 'crew_disband', metadata: { crewName: name } });
      return message.reply({ embeds: [embed.success('Crew Disbanded', `**${name}** has been dissolved.`)] });
    }

    if (sub === 'tag') {
      const tag = args.slice(1).join(' ').trim();
      if (!tag || tag.length > 10) return message.reply({ embeds: [embed.error('Tag must be 1-10 characters.')] });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return message.reply({ embeds: [embed.error('Only the crew leader can set the tag.')] });
      crew.tag = tag;
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_tag', metadata: { crewName: crew.name, tag } });
      return message.reply({ embeds: [embed.success('Tag Set', `**${crew.name}** tag is now \`${tag}\`.`)] });
    }

    if (sub === 'describe') {
      const text = args.slice(1).join(' ').trim();
      if (!text || text.length > 120) return message.reply({ embeds: [embed.error('Description must be 1-120 characters.')] });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return message.reply({ embeds: [embed.error('Only the crew leader can set the description.')] });
      crew.description = text;
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_describe', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [embed.success('Description Set', `**${crew.name}** description updated.`)] });
    }

    if (sub === 'list') {
      const crews = await Crew.find({ guildId }).sort({ createdAt: -1 }).limit(10);
      if (!crews.length) return message.reply({ embeds: [embed.info('Crews', 'No crews exist in this server yet.')] });
      return message.reply({ embeds: [buildListEmbed(crews)] });
    }

    if (sub === 'info') {
      const crewName = args.slice(1).join(' ').trim();
      const crew = crewName
        ? await Crew.findOne({ guildId, name: new RegExp(`^${crewName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
        : await findCrewByMember(guildId, userId);
      if (!crew) return message.reply({ embeds: [embed.error('No crew found.')] });
      return message.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    return message.reply({ embeds: [embed.error('Unknown subcommand. Use: create, invite, join, leave, kick, disband, tag, describe, info, list.')] });
  },

  async executeSlash({ interaction }) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (sub === 'create') {
      const name = interaction.options.getString('name');
      if (await findCrewByMember(guildId, userId)) return interaction.reply({ embeds: [embed.error('You are already in a crew.')], ephemeral: true });
      const existing = await Crew.findOne({ guildId, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (existing) return interaction.reply({ embeds: [embed.error('A crew with that name already exists.')], ephemeral: true });
      const crew = await Crew.create({ guildId, name, leaderId: userId, members: [userId], invites: [] });
      await logAudit({ guildId, actorId: userId, action: 'crew_create', metadata: { crewName: name } });
      return interaction.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'invite') {
      const target = interaction.options.getUser('user');
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return interaction.reply({ embeds: [embed.error('Only the crew leader can invite.')], ephemeral: true });
      if (crew.members.length >= MAX_CREW_SIZE) return interaction.reply({ embeds: [embed.error('Your crew is full.')], ephemeral: true });
      if (await findCrewByMember(guildId, target.id)) return interaction.reply({ embeds: [embed.error('That user is already in a crew.')], ephemeral: true });
      if (!crew.invites.includes(target.id)) crew.invites.push(target.id);
      await crew.save();
      await logAudit({ guildId, actorId: userId, targetId: target.id, action: 'crew_invite', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [embed.success('Invite Sent', `<@${target.id}> can now join **${crew.name}**.`)] });
    }

    if (sub === 'join') {
      const crewName = interaction.options.getString('name');
      const crew = await Crew.findOne({ guildId, name: new RegExp(`^${crewName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (await findCrewByMember(guildId, userId)) return interaction.reply({ embeds: [embed.error('You are already in a crew.')], ephemeral: true });
      if (!crew) return interaction.reply({ embeds: [embed.error('That crew does not exist.')], ephemeral: true });
      if (!crew.invites.includes(userId)) return interaction.reply({ embeds: [embed.error('You were not invited.')], ephemeral: true });
      if (crew.members.length >= MAX_CREW_SIZE) return interaction.reply({ embeds: [embed.error('That crew is full.')], ephemeral: true });
      crew.members.push(userId);
      crew.invites = crew.invites.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_join', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'leave') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew) return interaction.reply({ embeds: [embed.error('You are not in a crew.')], ephemeral: true });
      if (crew.leaderId === userId) return interaction.reply({ embeds: [embed.error('Leaders must disband the crew.')], ephemeral: true });
      crew.members = crew.members.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_leave', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [embed.success('Crew Left', `You left **${crew.name}**.`)] });
    }

    if (sub === 'kick') {
      const target = interaction.options.getUser('user');
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return interaction.reply({ embeds: [embed.error('Only the crew leader can kick.')], ephemeral: true });
      if (target.id === userId || !crew.members.includes(target.id)) return interaction.reply({ embeds: [embed.error('That user cannot be kicked.')], ephemeral: true });
      crew.members = crew.members.filter((id) => id !== target.id);
      await crew.save();
      await logAudit({ guildId, actorId: userId, targetId: target.id, action: 'crew_kick', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [embed.success('Crew Updated', `<@${target.id}> was removed from **${crew.name}**.`)] });
    }

    if (sub === 'disband') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return interaction.reply({ embeds: [embed.error('Only the crew leader can disband.')], ephemeral: true });
      const name = crew.name;
      await Crew.deleteOne({ _id: crew._id });
      await logAudit({ guildId, actorId: userId, action: 'crew_disband', metadata: { crewName: name } });
      return interaction.reply({ embeds: [embed.success('Crew Disbanded', `**${name}** has been dissolved.`)] });
    }

    if (sub === 'tag') {
      const tag = interaction.options.getString('tag');
      if (tag.length > 10) return interaction.reply({ embeds: [embed.error('Tag must be 10 characters or less.')], ephemeral: true });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return interaction.reply({ embeds: [embed.error('Only the crew leader can set the tag.')], ephemeral: true });
      crew.tag = tag;
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_tag', metadata: { crewName: crew.name, tag } });
      return interaction.reply({ embeds: [embed.success('Tag Set', `**${crew.name}** tag is now \`${tag}\`.`)] });
    }

    if (sub === 'describe') {
      const text = interaction.options.getString('text');
      if (text.length > 120) return interaction.reply({ embeds: [embed.error('Description must be 120 characters or less.')], ephemeral: true });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId) return interaction.reply({ embeds: [embed.error('Only the crew leader can set the description.')], ephemeral: true });
      crew.description = text;
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_describe', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [embed.success('Description Set', `**${crew.name}** description updated.`)] });
    }

    if (sub === 'list') {
      const crews = await Crew.find({ guildId }).sort({ createdAt: -1 }).limit(10);
      if (!crews.length) return interaction.reply({ embeds: [embed.info('Crews', 'No crews exist in this server yet.')], ephemeral: true });
      return interaction.reply({ embeds: [buildListEmbed(crews)] });
    }

    if (sub === 'info') {
      const crewName = interaction.options.getString('name');
      const crew = crewName
        ? await Crew.findOne({ guildId, name: new RegExp(`^${crewName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
        : await findCrewByMember(guildId, userId);
      if (!crew) return interaction.reply({ embeds: [embed.error('No crew found.')], ephemeral: true });
      return interaction.reply({ embeds: [buildCrewEmbed(crew)] });
    }
  },
};

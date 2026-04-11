const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser } = require('../../utils/economy');
const Crew = require('../../models/Crew');
const { logAudit } = require('../../utils/audit');

const MAX_CREW_SIZE = 8;

async function findCrewByMember(guildId, userId) {
  return Crew.findOne({ guildId, members: userId });
}

function buildCrewEmbed(crew) {
  return embed
    .raw(0x2b2d31)
    .setTitle(`Crew: ${crew.name}`)
    .addFields(
      { name: 'Leader', value: `<@${crew.leaderId}>`, inline: true },
      { name: 'Members', value: `${crew.members.length}/${MAX_CREW_SIZE}`, inline: true },
      { name: 'Invites', value: `${crew.invites.length}`, inline: true },
      { name: 'Roster', value: crew.members.map((id) => `<@${id}>`).join(', '), inline: false },
    );
}

module.exports = {
  name: 'crew',
  aliases: ['gang'],
  description: 'Create and manage a permanent heist crew.',
  usage: '<create|invite|join|leave|kick|disband|info|list> ...',
  category: 'heist',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('crew')
    .setDescription('Manage a permanent heist crew')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create a new crew')
        .addStringOption((o) => o.setName('name').setDescription('Crew name').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('invite')
        .setDescription('Invite a user to your crew')
        .addUserOption((o) => o.setName('user').setDescription('User to invite').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('join')
        .setDescription('Join a crew you were invited to')
        .addStringOption((o) => o.setName('name').setDescription('Crew name').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('leave').setDescription('Leave your current crew'))
    .addSubcommand((s) =>
      s
        .setName('kick')
        .setDescription('Kick a member from your crew')
        .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('disband').setDescription('Disband your crew'))
    .addSubcommand((s) =>
      s
        .setName('info')
        .setDescription('View a crew')
        .addStringOption((o) => o.setName('name').setDescription('Crew name').setRequired(false)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('List crews in this server')),

  async execute({ message, args }) {
    const sub = (args[0] || 'info').toLowerCase();
    const guildId = message.guild.id;
    const userId = message.author.id;

    if (sub === 'create') {
      const name = args.slice(1).join(' ').trim();
      if (!name || name.length > 30)
        return message.reply({ embeds: [embed.error('Usage: `.crew create <name>` with a 1-30 character name.')] });
      if (await findCrewByMember(guildId, userId))
        return message.reply({
          embeds: [embed.error('You are already in a crew. Leave it before creating a new one.')],
        });
      if (await Crew.findOne({ guildId, name: new RegExp(`^${name}$`, 'i') }))
        return message.reply({ embeds: [embed.error('A crew with that name already exists.')] });
      const crew = await Crew.create({ guildId, name, leaderId: userId, members: [userId], invites: [] });
      await logAudit({ guildId, actorId: userId, action: 'crew_create', metadata: { crewName: name } });
      return message.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'invite') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.crew invite @user`')] });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId)
        return message.reply({ embeds: [embed.error('Only the crew leader can invite members.')] });
      if (crew.members.length >= MAX_CREW_SIZE) return message.reply({ embeds: [embed.error('Your crew is full.')] });
      if (await findCrewByMember(guildId, target.id))
        return message.reply({ embeds: [embed.error('That user is already in a crew.')] });
      if (!crew.invites.includes(target.id)) crew.invites.push(target.id);
      await crew.save();
      await logAudit({
        guildId,
        actorId: userId,
        targetId: target.id,
        action: 'crew_invite',
        metadata: { crewName: crew.name },
      });
      return message.reply({
        embeds: [
          embed.success(
            'Crew Invite Sent',
            `<@${target.id}> can now join **${crew.name}** with \.crew join ${crew.name}`,
          ),
        ],
      });
    }

    if (sub === 'join') {
      const crewName = args.slice(1).join(' ').trim();
      if (!crewName) return message.reply({ embeds: [embed.error('Usage: `.crew join <crew-name>`')] });
      if (await findCrewByMember(guildId, userId))
        return message.reply({ embeds: [embed.error('You are already in a crew.')] });
      const crew = await Crew.findOne({ guildId, name: new RegExp(`^${crewName}$`, 'i') });
      if (!crew) return message.reply({ embeds: [embed.error('That crew does not exist.')] });
      if (!crew.invites.includes(userId))
        return message.reply({ embeds: [embed.error('You were not invited to that crew.')] });
      if (crew.members.length >= MAX_CREW_SIZE)
        return message.reply({ embeds: [embed.error('That crew is already full.')] });
      crew.members.push(userId);
      crew.invites = crew.invites.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_join', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'leave') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew) return message.reply({ embeds: [embed.error('You are not in a crew.')] });
      if (crew.leaderId === userId)
        return message.reply({
          embeds: [embed.error('Leaders must use `.crew disband` or transfer leadership in a future update.')],
        });
      crew.members = crew.members.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_leave', metadata: { crewName: crew.name } });
      return message.reply({ embeds: [embed.success('Crew Left', `You left **${crew.name}**.`)] });
    }

    if (sub === 'kick') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [embed.error('Usage: `.crew kick @user`')] });
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId)
        return message.reply({ embeds: [embed.error('Only the crew leader can kick members.')] });
      if (target.id === userId)
        return message.reply({ embeds: [embed.error('Use `.crew disband` if you want to dissolve the crew.')] });
      if (!crew.members.includes(target.id))
        return message.reply({ embeds: [embed.error('That user is not in your crew.')] });
      crew.members = crew.members.filter((id) => id !== target.id);
      await crew.save();
      await logAudit({
        guildId,
        actorId: userId,
        targetId: target.id,
        action: 'crew_kick',
        metadata: { crewName: crew.name },
      });
      return message.reply({
        embeds: [embed.success('Crew Updated', `<@${target.id}> was removed from **${crew.name}**.`)],
      });
    }

    if (sub === 'disband') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId)
        return message.reply({ embeds: [embed.error('Only the crew leader can disband the crew.')] });
      const name = crew.name;
      await Crew.deleteOne({ _id: crew._id });
      await logAudit({ guildId, actorId: userId, action: 'crew_disband', metadata: { crewName: name } });
      return message.reply({ embeds: [embed.success('Crew Disbanded', `**${name}** has been dissolved.`)] });
    }

    if (sub === 'list') {
      const crews = await Crew.find({ guildId }).sort({ createdAt: -1 }).limit(10);
      if (!crews.length)
        return message.reply({ embeds: [embed.info('Crew List', 'No permanent crews exist in this server yet.')] });
      return message.reply({
        embeds: [
          embed
            .raw(0x2b2d31)
            .setTitle('Crew List')
            .setDescription(
              crews
                .map(
                  (crew) => `**${crew.name}** - leader <@${crew.leaderId}> - ${crew.members.length}/${MAX_CREW_SIZE}`,
                )
                .join('\n'),
            ),
        ],
      });
    }

    if (sub === 'info') {
      const crewName = args.slice(1).join(' ').trim();
      const crew = crewName
        ? await Crew.findOne({ guildId, name: new RegExp(`^${crewName}$`, 'i') })
        : await findCrewByMember(guildId, userId);
      if (!crew) return message.reply({ embeds: [embed.error('No crew found.')] });
      return message.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    return message.reply({ embeds: [embed.error('Unknown crew subcommand.')] });
  },

  async executeSlash({ interaction }) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (sub === 'create') {
      const name = interaction.options.getString('name');
      if (await findCrewByMember(guildId, userId))
        return interaction.reply({
          embeds: [embed.error('You are already in a crew. Leave it before creating a new one.')],
          ephemeral: true,
        });
      if (await Crew.findOne({ guildId, name: new RegExp(`^${name}$`, 'i') }))
        return interaction.reply({ embeds: [embed.error('A crew with that name already exists.')], ephemeral: true });
      const crew = await Crew.create({ guildId, name, leaderId: userId, members: [userId], invites: [] });
      await logAudit({ guildId, actorId: userId, action: 'crew_create', metadata: { crewName: name } });
      return interaction.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'invite') {
      const target = interaction.options.getUser('user');
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId)
        return interaction.reply({
          embeds: [embed.error('Only the crew leader can invite members.')],
          ephemeral: true,
        });
      if (crew.members.length >= MAX_CREW_SIZE)
        return interaction.reply({ embeds: [embed.error('Your crew is full.')], ephemeral: true });
      if (await findCrewByMember(guildId, target.id))
        return interaction.reply({ embeds: [embed.error('That user is already in a crew.')], ephemeral: true });
      if (!crew.invites.includes(target.id)) crew.invites.push(target.id);
      await crew.save();
      await logAudit({
        guildId,
        actorId: userId,
        targetId: target.id,
        action: 'crew_invite',
        metadata: { crewName: crew.name },
      });
      return interaction.reply({
        embeds: [embed.success('Crew Invite Sent', `<@${target.id}> can now join **${crew.name}**.`)],
      });
    }

    if (sub === 'join') {
      const crew = await Crew.findOne({ guildId, name: new RegExp(`^${interaction.options.getString('name')}$`, 'i') });
      if (await findCrewByMember(guildId, userId))
        return interaction.reply({ embeds: [embed.error('You are already in a crew.')], ephemeral: true });
      if (!crew) return interaction.reply({ embeds: [embed.error('That crew does not exist.')], ephemeral: true });
      if (!crew.invites.includes(userId))
        return interaction.reply({ embeds: [embed.error('You were not invited to that crew.')], ephemeral: true });
      if (crew.members.length >= MAX_CREW_SIZE)
        return interaction.reply({ embeds: [embed.error('That crew is full.')], ephemeral: true });
      crew.members.push(userId);
      crew.invites = crew.invites.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_join', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [buildCrewEmbed(crew)] });
    }

    if (sub === 'leave') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew) return interaction.reply({ embeds: [embed.error('You are not in a crew.')], ephemeral: true });
      if (crew.leaderId === userId)
        return interaction.reply({
          embeds: [embed.error('Leaders must disband the crew to leave it.')],
          ephemeral: true,
        });
      crew.members = crew.members.filter((id) => id !== userId);
      await crew.save();
      await logAudit({ guildId, actorId: userId, action: 'crew_leave', metadata: { crewName: crew.name } });
      return interaction.reply({ embeds: [embed.success('Crew Left', `You left **${crew.name}**.`)] });
    }

    if (sub === 'kick') {
      const target = interaction.options.getUser('user');
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId)
        return interaction.reply({ embeds: [embed.error('Only the crew leader can kick members.')], ephemeral: true });
      if (!crew.members.includes(target.id) || target.id === userId)
        return interaction.reply({
          embeds: [embed.error('That user cannot be kicked from your crew.')],
          ephemeral: true,
        });
      crew.members = crew.members.filter((id) => id !== target.id);
      await crew.save();
      await logAudit({
        guildId,
        actorId: userId,
        targetId: target.id,
        action: 'crew_kick',
        metadata: { crewName: crew.name },
      });
      return interaction.reply({
        embeds: [embed.success('Crew Updated', `<@${target.id}> was removed from **${crew.name}**.`)],
      });
    }

    if (sub === 'disband') {
      const crew = await findCrewByMember(guildId, userId);
      if (!crew || crew.leaderId !== userId)
        return interaction.reply({
          embeds: [embed.error('Only the crew leader can disband the crew.')],
          ephemeral: true,
        });
      const name = crew.name;
      await Crew.deleteOne({ _id: crew._id });
      await logAudit({ guildId, actorId: userId, action: 'crew_disband', metadata: { crewName: name } });
      return interaction.reply({ embeds: [embed.success('Crew Disbanded', `**${name}** has been dissolved.`)] });
    }

    if (sub === 'list') {
      const crews = await Crew.find({ guildId }).sort({ createdAt: -1 }).limit(10);
      if (!crews.length)
        return interaction.reply({ embeds: [embed.info('Crew List', 'No permanent crews exist in this server yet.')] });
      return interaction.reply({
        embeds: [
          embed
            .raw(0x2b2d31)
            .setTitle('Crew List')
            .setDescription(
              crews
                .map(
                  (crew) => `**${crew.name}** - leader <@${crew.leaderId}> - ${crew.members.length}/${MAX_CREW_SIZE}`,
                )
                .join('\n'),
            ),
        ],
      });
    }

    if (sub === 'info') {
      const crewName = interaction.options.getString('name');
      const crew = crewName
        ? await Crew.findOne({ guildId, name: new RegExp(`^${crewName}$`, 'i') })
        : await findCrewByMember(guildId, userId);
      if (!crew) return interaction.reply({ embeds: [embed.error('No crew found.')], ephemeral: true });
      return interaction.reply({ embeds: [buildCrewEmbed(crew)] });
    }
  },
};

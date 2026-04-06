const { ChannelType, PermissionsBitField } = require('discord.js');
const Guild = require('../models/Guild');
const embed = require('../utils/embed');
const { DEFAULT_PREFIX, DEV_LOG_CHANNEL_ID } = require('../config');
const { buildSetupEmbed } = require('../utils/setupMessage');

const PREFERRED_CHANNEL_NAMES = ['bot-commands', 'bot', 'commands', 'general'];

function canSendInChannel(channel, botMember) {
  if (!channel || !botMember) return false;
  if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;

  return channel.permissionsFor(botMember)?.has([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
  ]);
}

async function findWelcomeChannel(guild) {
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember) return null;

  if (canSendInChannel(guild.systemChannel, botMember)) {
    return guild.systemChannel;
  }

  const fetchedChannels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const sendableChannels = fetchedChannels
    .filter(channel => canSendInChannel(channel, botMember))
    .sort((a, b) => a.rawPosition - b.rawPosition);

  const preferredChannel = PREFERRED_CHANNEL_NAMES
    .map(name => sendableChannels.find(channel => channel.name?.toLowerCase() === name))
    .find(Boolean);
  return preferredChannel || sendableChannels.first() || null;
}

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    const guildData = await Guild.findOrCreate(guild.id);
    const welcomeChannel = await findWelcomeChannel(guild);

    if (welcomeChannel) {
      await welcomeChannel.send({
        embeds: [buildSetupEmbed(guildData.prefix || DEFAULT_PREFIX)],
      }).catch(() => {});
    }

    let ownerId = 'Unknown';
    try {
      const owner = await guild.fetchOwner();
      ownerId = owner.id;
    } catch (error) {
      ownerId = guild.ownerId || 'Unknown';
    }

    const devEmbed = embed.raw(0x457B9D)
      .setTitle('Bot Joined New Server')
      .setDescription(`**${guild.name}**`)
      .addFields(
        { name: 'Server ID', value: guild.id, inline: true },
        { name: 'Owner ID', value: ownerId, inline: true },
        { name: 'Members', value: `${guild.memberCount || 0}`, inline: true }
      );

    if (!DEV_LOG_CHANNEL_ID) return;

    try {
      const logChannel = await client.channels.fetch(DEV_LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [devEmbed] });
      }
    } catch (error) {
      console.error(`Failed to send guild join notification to channel ${DEV_LOG_CHANNEL_ID}:`, error);
    }
  },
};

module.exports._test = {
  canSendInChannel,
  findWelcomeChannel,
};

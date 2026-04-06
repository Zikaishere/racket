const { ChannelType, PermissionsBitField } = require('discord.js');
const Guild = require('../models/Guild');
const embed = require('../utils/embed');
const { DEFAULT_PREFIX, DEV_LOG_CHANNEL_ID } = require('../config');
const { buildSetupEmbed } = require('../utils/setupMessage');

function findWelcomeChannel(guild) {
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.members.me)?.has([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
  ])) {
    return guild.systemChannel;
  }

  return guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .find(channel => channel.permissionsFor(guild.members.me)?.has([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
    ]));
}

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    const guildData = await Guild.findOrCreate(guild.id);
    const welcomeChannel = findWelcomeChannel(guild);

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
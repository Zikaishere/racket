const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');

module.exports = {
  name: 'serverinfo',
  aliases: ['si', 'server'],
  description: 'Display information about the current server.',
  usage: '',
  category: 'info',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('serverinfo').setDescription('Display information about the current server'),

  async execute({ message }) {
    return run({ guild: message.guild, reply: (d) => message.reply(d) });
  },

  async executeSlash({ interaction }) {
    return run({ guild: interaction.guild, reply: (d) => interaction.reply(d) });
  },
};

async function run({ guild, reply }) {
  await guild.fetch();

  const owner = await guild.fetchOwner();
  const channels = guild.channels.cache;
  const textChannels = channels.filter((c) => c.type === 0).size;
  const voiceChannels = channels.filter((c) => c.type === 2).size;
  const categories = channels.filter((c) => c.type === 4).size;
  const roles = guild.roles.cache.size - 1; // exclude @everyone
  const emojis = guild.emojis.cache.size;
  const boosts = guild.premiumSubscriptionCount;
  const boostTier = guild.premiumTier;
  const verificationLevel = ['None', 'Low', 'Medium', 'High', 'Very High'][guild.verificationLevel];
  const createdAt = Math.floor(guild.createdTimestamp / 1000);

  const e = embed
    .info(`📋 ${guild.name}`, null)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
      { name: '🆔 Server ID', value: guild.id, inline: true },
      { name: '📅 Created', value: `<t:${createdAt}:D> (<t:${createdAt}:R>)`, inline: true },
      { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
      {
        name: '💬 Channels',
        value: `${textChannels} text · ${voiceChannels} voice · ${categories} categories`,
        inline: true,
      },
      { name: '🎭 Roles', value: `${roles}`, inline: true },
      { name: '😄 Emojis', value: `${emojis}`, inline: true },
      { name: '🚀 Boosts', value: `${boosts} (Tier ${boostTier})`, inline: true },
      { name: '🔒 Verification', value: verificationLevel, inline: true },
    );

  if (guild.bannerURL()) e.setImage(guild.bannerURL({ size: 1024 }));

  return reply({ embeds: [e] });
}

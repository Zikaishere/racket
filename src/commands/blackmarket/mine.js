const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const BlackMarket = require('../../models/BlackMarket');
const { fmt } = require('../../utils/economy');

const run = async ({ userId, guildId, reply }) => {
  const listings = await BlackMarket.find({
    guildId,
    sellerId: userId,
    sold: false,
    quantity: { $gt: 0 },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 }).limit(10);

  if (!listings.length) {
    return reply({ embeds: [embed.info('Your Listings', 'You do not have any active black market listings.')] });
  }

  const marketEmbed = embed.raw(0x2b2d31)
    .setTitle('Your Listings')
    .setDescription('Use `bm-cancel <id>` to remove one of your listings.');

  for (const listing of listings) {
    const remainingHours = Math.max(1, Math.ceil((listing.expiresAt.getTime() - Date.now()) / 3600000));
    marketEmbed.addFields({
      name: `${listing.itemName} x${listing.quantity} - ${fmt(listing.price)} each`,
      value: `${listing.itemDesc}\nExpires in ${remainingHours}h | ID: \`${listing._id.toString().slice(-6)}\``,
    });
  }

  return reply({ embeds: [marketEmbed] });
};

module.exports = {
  name: 'bm-mine',
  aliases: ['bmmine', 'mylistings'],
  description: 'View your active black market listings.',
  usage: '',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('bm-mine')
    .setDescription('View your active black market listings'),

  async execute({ message }) {
    return run({ userId: message.author.id, guildId: message.guild.id, reply: data => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({ userId: interaction.user.id, guildId: interaction.guild.id, reply: data => interaction.reply(data) });
  },
};
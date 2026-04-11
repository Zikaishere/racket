const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const BlackMarket = require('../../models/BlackMarket');
const { fmt } = require('../../utils/economy');

const PAGE_SIZE = 8;

const run = async ({ guildId, page, reply }) => {
  const currentPage = Math.max(1, page || 1);
  const query = {
    guildId,
    sold: false,
    quantity: { $gt: 0 },
    expiresAt: { $gt: new Date() },
  };

  const total = await BlackMarket.countDocuments(query);
  if (!total) {
    return reply({
      embeds: [embed.info('Black Market', 'No listings are available right now. Use `/bm-list` to post one.')],
      ephemeral: true,
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const listings = await BlackMarket.find(query)
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  const marketEmbed = embed
    .raw(0x2b2d31)
    .setTitle('Black Market')
    .setDescription('Use `/bm-buy <id>` or `.bm-buy <id>` to purchase a listing.');

  for (const listing of listings) {
    const remainingHours = Math.max(1, Math.ceil((listing.expiresAt.getTime() - Date.now()) / 3600000));
    marketEmbed.addFields({
      name: `${listing.itemName} x${listing.quantity} - ${fmt(listing.price)} each`,
      value: `${listing.itemDesc}\nSeller: <@${listing.sellerId}> | Expires in ${remainingHours}h | ID: \`${listing._id.toString().slice(-6)}\``,
    });
  }

  marketEmbed.setFooter({ text: `Page ${safePage}/${totalPages} | ${total} active listing(s)` });
  return reply({ embeds: [marketEmbed] });
};

module.exports = {
  name: 'bm-browse',
  aliases: ['bmbrowse', 'bmshop', 'market'],
  description: 'Browse current Black Market listings.',
  usage: '[page]',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('bm-browse')
    .setDescription('Browse current Black Market listings')
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)),

  async execute({ message, args }) {
    return run({ guildId: message.guild.id, page: parseInt(args[0], 10) || 1, reply: (data) => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({
      guildId: interaction.guild.id,
      page: interaction.options.getInteger('page') || 1,
      reply: (data) => interaction.reply(data),
    });
  },
};

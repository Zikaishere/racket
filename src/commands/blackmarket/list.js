const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const BlackMarket = require('../../models/BlackMarket');
const { logAudit } = require('../../utils/audit');
const {
  BLACKMARKET_LISTING_FEE,
  BLACKMARKET_MAX_LISTINGS,
  BLACKMARKET_EXPIRY,
} = require('../../config');

const parsePrefixArgs = (args) => {
  const price = parseInt(args[0], 10);
  const joined = args.slice(1).join(' ').trim();
  if (!joined) {
    return { price, itemName: undefined, itemDesc: undefined, quantity: 1 };
  }

  const segments = joined.split('|').map(segment => segment.trim()).filter(Boolean);
  const itemName = segments[0];
  let itemDesc = segments[1] || undefined;
  let quantity = 1;

  if (segments[2]) {
    quantity = parseInt(segments[2], 10);
  } else if (itemDesc) {
    const quantityMatch = itemDesc.match(/^(.*)\s+\[(\d{1,2})\]$/);
    if (quantityMatch) {
      itemDesc = quantityMatch[1].trim();
      quantity = parseInt(quantityMatch[2], 10);
    }
  }

  return { price, itemName, itemDesc, quantity };
};

const run = async ({ userId, guildId, itemName, itemDesc, price, quantity, reply }) => {
  if (!itemName || itemName.length > 50) {
    return reply({ embeds: [embed.error('Item name must be 1-50 characters.')], ephemeral: true });
  }

  if (isNaN(price) || price <= 0) {
    return reply({ embeds: [embed.error('Please enter a valid price.')], ephemeral: true });
  }

  if (isNaN(quantity) || quantity <= 0 || quantity > 99) {
    return reply({ embeds: [embed.error('Quantity must be between 1 and 99.')], ephemeral: true });
  }

  const user = await getUser(userId, guildId);
  if (user.balance < BLACKMARKET_LISTING_FEE) {
    return reply({
      embeds: [embed.error(`You need ${fmt(BLACKMARKET_LISTING_FEE)} to post a listing (listing fee).`)],
      ephemeral: true,
    });
  }

  const existing = await BlackMarket.countDocuments({
    sellerId: userId,
    guildId,
    sold: false,
    expiresAt: { $gt: new Date() },
  });

  if (existing >= BLACKMARKET_MAX_LISTINGS) {
    return reply({
      embeds: [embed.error(`You can only have ${BLACKMARKET_MAX_LISTINGS} active listings at a time.`)],
      ephemeral: true,
    });
  }

  user.balance -= BLACKMARKET_LISTING_FEE;
  await user.save();

  const listing = await BlackMarket.create({
    guildId,
    sellerId: userId,
    itemName,
    itemDesc: itemDesc || 'No description.',
    price,
    quantity,
    expiresAt: new Date(Date.now() + BLACKMARKET_EXPIRY),
  });

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'blackmarket_list',
    amount: BLACKMARKET_LISTING_FEE,
    currency: 'wallet',
    metadata: {
      listingId: listing._id.toString(),
      itemName,
      price,
      quantity,
    },
  });

  return reply({
    embeds: [
      embed.success(
        'Listing Posted',
        `**${itemName}** x${quantity} is now listed for ${fmt(price)} each.\n\nListing fee paid: ${fmt(BLACKMARKET_LISTING_FEE)}\nListing ID: \`${listing._id.toString().slice(-6)}\``
      ),
    ],
  });
};

module.exports = {
  name: 'bm-list',
  aliases: ['bmlist', 'bmsell'],
  description: 'List an item on the Black Market.',
  usage: '<price> <name> | [description] | [quantity]',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('bm-list')
    .setDescription('List an item on the Black Market')
    .addIntegerOption(o => o.setName('price').setDescription('Listing price per item').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Item description').setRequired(false))
    .addIntegerOption(o => o.setName('quantity').setDescription('How many are available').setRequired(false).setMinValue(1).setMaxValue(99)),

  async execute({ message, args }) {
    const { price, itemName, itemDesc, quantity } = parsePrefixArgs(args);
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      itemName,
      itemDesc,
      price,
      quantity,
      reply: data => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      itemName: interaction.options.getString('name'),
      itemDesc: interaction.options.getString('description'),
      price: interaction.options.getInteger('price'),
      quantity: interaction.options.getInteger('quantity') || 1,
      reply: data => interaction.reply(data),
    });
  },
};
const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const embed = require('../../utils/embed');
const { fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const User = require('../../models/User');
const BlackMarket = require('../../models/BlackMarket');

const addInventoryItem = (inventory, listing, quantity) => {
  const existing = inventory.find((item) => item.name.toLowerCase() === listing.itemName.toLowerCase());
  if (existing) {
    existing.quantity += quantity;
    existing.description = existing.description || listing.itemDesc || 'No description.';
    existing.estimatedValue = Math.max(existing.estimatedValue || 0, listing.price || 0);
    return inventory;
  }

  inventory.push({
    itemId: listing._id.toString(),
    name: listing.itemName,
    description: listing.itemDesc || 'No description.',
    quantity,
    estimatedValue: listing.price,
    source: 'blackmarket',
    acquiredAt: new Date(),
  });
  return inventory;
};

const findListingByShortId = async (guildId, listingId) => {
  const listings = await BlackMarket.find({
    guildId,
    sold: false,
    quantity: { $gt: 0 },
    expiresAt: { $gt: new Date() },
  });

  return listings.find((listing) => listing._id.toString().slice(-6).toLowerCase() === listingId.toLowerCase());
};

const run = async ({ userId, guildId, listingId, quantity, reply }) => {
  if (!listingId) {
    return reply({ embeds: [embed.error('Please provide a listing ID from `bm-browse`.')], ephemeral: true });
  }

  const desiredQuantity = Math.max(1, quantity || 1);
  const listing = await findListingByShortId(guildId, listingId);

  if (!listing) {
    return reply({
      embeds: [embed.error('Listing not found or already sold. Use `bm-browse` to see active listings.')],
      ephemeral: true,
    });
  }

  if (listing.sellerId === userId) {
    return reply({ embeds: [embed.error('You cannot buy your own listing.')], ephemeral: true });
  }

  if (desiredQuantity > listing.quantity) {
    return reply({
      embeds: [embed.error(`Only ${listing.quantity} item(s) are available in that listing.`)],
      ephemeral: true,
    });
  }

  const totalCost = listing.price * desiredQuantity;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const lockedListing = await BlackMarket.findOne({
        _id: listing._id,
        guildId,
        sold: false,
        quantity: { $gte: desiredQuantity },
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (!lockedListing) {
        throw new Error('LISTING_UNAVAILABLE');
      }

      const buyer = await User.findOneAndUpdate(
        { userId, guildId },
        { $setOnInsert: { userId, guildId } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session },
      );

      if (buyer.balance < totalCost) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      buyer.balance -= totalCost;
      buyer.inventory = addInventoryItem([...buyer.inventory], lockedListing, desiredQuantity);
      await buyer.save({ session });

      await User.findOneAndUpdate(
        { userId: lockedListing.sellerId, guildId },
        {
          $setOnInsert: { userId: lockedListing.sellerId, guildId },
          $inc: { balance: totalCost, 'stats.blackmarketSales': desiredQuantity },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, session },
      );

      lockedListing.quantity -= desiredQuantity;
      if (lockedListing.quantity <= 0) {
        lockedListing.quantity = 0;
        lockedListing.sold = true;
        lockedListing.buyerId = userId;
      }
      await lockedListing.save({ session });
    });
  } catch (error) {
    await session.endSession();

    if (error.message === 'LISTING_UNAVAILABLE') {
      return reply({
        embeds: [embed.error('That listing was just sold, reduced, or expired. Refresh the market and try again.')],
        ephemeral: true,
      });
    }

    if (error.message === 'INSUFFICIENT_FUNDS') {
      const buyer = await User.findOrCreate(userId, guildId);
      return reply({
        embeds: [embed.error(`You need ${fmt(totalCost)} to buy that quantity. Your balance: ${fmt(buyer.balance)}`)],
        ephemeral: true,
      });
    }

    throw error;
  }

  await session.endSession();
  const updatedBuyer = await User.findOrCreate(userId, guildId);

  await logAudit({
    guildId,
    actorId: userId,
    targetId: listing.sellerId,
    action: 'blackmarket_buy',
    amount: totalCost,
    currency: 'wallet',
    metadata: {
      listingId: listing._id.toString(),
      itemName: listing.itemName,
      quantity: desiredQuantity,
      unitPrice: listing.price,
    },
  });

  return reply({
    embeds: [
      embed.success(
        'Purchase Complete',
        `You bought **${listing.itemName}** x${desiredQuantity} for ${fmt(totalCost)}.\n\nNew balance: ${fmt(updatedBuyer.balance)}`,
      ),
    ],
  });
};

module.exports = {
  name: 'bm-buy',
  aliases: ['bmbuy'],
  description: 'Buy a listing from the Black Market.',
  usage: '<listing-id> [quantity]',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('bm-buy')
    .setDescription('Buy a listing from the Black Market')
    .addStringOption((o) =>
      o.setName('id').setDescription('Listing ID (last 6 characters shown in bm-browse)').setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName('quantity').setDescription('How many to buy').setRequired(false).setMinValue(1).setMaxValue(99),
    ),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      listingId: args[0],
      quantity: parseInt(args[1], 10) || 1,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      listingId: interaction.options.getString('id'),
      quantity: interaction.options.getInteger('quantity') || 1,
      reply: (data) => interaction.reply(data),
    });
  },
};

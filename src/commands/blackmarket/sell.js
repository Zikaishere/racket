const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');

function getInventorySorted(user) {
  return [...(user.inventory || [])].filter((item) => item.quantity > 0).sort((a, b) => a.name.localeCompare(b.name));
}

function findEntryIndex(inventory, query) {
  const asIndex = parseInt(query, 10);
  if (!isNaN(asIndex) && asIndex >= 1 && asIndex <= inventory.length) {
    return asIndex - 1;
  }

  return inventory.findIndex((item) => item.name.toLowerCase() === query.toLowerCase());
}

const run = async ({ userId, guildId, query, quantity, reply }) => {
  const user = await getUser(userId, guildId);
  const inventory = getInventorySorted(user);

  if (!inventory.length) {
    return reply({ embeds: [embed.info('Inventory Sell', 'Your inventory is empty.')] });
  }

  const itemIndex = findEntryIndex(inventory, query);
  if (itemIndex === -1) {
    return reply({
      embeds: [
        embed.error(
          'That item was not found in your inventory. Use `inventory` to see your item names or slot numbers.',
        ),
      ],
    });
  }

  const item = inventory[itemIndex];
  const sellQuantity = Math.max(1, quantity || 1);
  if (sellQuantity > item.quantity) {
    return reply({ embeds: [embed.error(`You only have ${item.quantity} of **${item.name}**.`)] });
  }

  const baseValue = Math.max(1, Math.floor((item.estimatedValue || 10) * 0.5));
  const payout = baseValue * sellQuantity;

  const actualEntry = user.inventory.find(
    (entry) => entry.name.toLowerCase() === item.name.toLowerCase() && entry.quantity > 0,
  );

  actualEntry.quantity -= sellQuantity;
  user.balance += payout;
  if (actualEntry.quantity <= 0) {
    user.inventory = user.inventory.filter(
      (entry) => !(entry.name.toLowerCase() === item.name.toLowerCase() && entry.quantity <= 0),
    );
  }

  await user.save();
  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'inventory_sell',
    amount: payout,
    currency: 'wallet',
    metadata: {
      itemName: item.name,
      quantity: sellQuantity,
      unitValue: baseValue,
    },
  });

  return reply({
    embeds: [
      embed.success(
        'Item Sold',
        `You sold **${item.name}** x${sellQuantity} for ${fmt(payout)}.\n\nNew balance: ${fmt(user.balance)}`,
      ),
    ],
  });
};

module.exports = {
  name: 'inv-sell',
  aliases: ['sellitem', 'fence'],
  description: 'Sell an item from your inventory for cash.',
  usage: '<item-name|slot-number> [quantity]',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('inv-sell')
    .setDescription('Sell an item from your inventory')
    .addStringOption((o) => o.setName('item').setDescription('Item name or slot number').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('quantity').setDescription('How many to sell').setRequired(false).setMinValue(1).setMaxValue(999),
    ),

  async execute({ message, args }) {
    const lastArg = args[args.length - 1];
    const parsedQuantity = parseInt(lastArg, 10);
    const quantity = !isNaN(parsedQuantity) ? parsedQuantity : 1;
    const query = !isNaN(parsedQuantity) ? args.slice(0, -1).join(' ') : args.join(' ');

    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      query,
      quantity,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      query: interaction.options.getString('item'),
      quantity: interaction.options.getInteger('quantity') || 1,
      reply: (data) => interaction.reply(data),
    });
  },
};

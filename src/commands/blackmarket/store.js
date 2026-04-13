const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { listStoreItems, getStoreItem, createInventoryItemFromStore } = require('../../utils/itemStore');

function buildBrowseEmbed() {
  const items = listStoreItems();
  const storeEmbed = embed
    .raw(0x2b2d31)
    .setTitle('Item Store')
    .setDescription('Buy useful animals and contraband for the underground scene.');

  for (const item of items) {
    const statsText =
      item.kind === 'chicken'
        ? `STR ${item.stats.strength} | SPD ${item.stats.speed} | GRT ${item.stats.grit}`
        : 'No stats';

    storeEmbed.addFields({
      name: `${item.name} - ${fmt(item.price)}`,
      value: `ID: \`${item.id}\` | ${item.rarity} ${item.kind}\n${item.description}\n${statsText}`,
      inline: false,
    });
  }

  return storeEmbed;
}

function buildInspectEmbed(item) {
  return embed
    .raw(0x2b2d31)
    .setTitle(`Store Item: ${item.name}`)
    .setDescription(item.description)
    .addFields(
      { name: 'ID', value: `\`${item.id}\``, inline: true },
      { name: 'Price', value: fmt(item.price), inline: true },
      { name: 'Rarity', value: item.rarity, inline: true },
      { name: 'Strength', value: `${item.stats?.strength || 0}`, inline: true },
      { name: 'Speed', value: `${item.stats?.speed || 0}`, inline: true },
      { name: 'Grit', value: `${item.stats?.grit || 0}`, inline: true },
    );
}

async function handleBuy(userId, guildId, itemId, quantity) {
  const item = getStoreItem(itemId);
  if (!item) return { error: 'That store item does not exist. Use `store browse` first.' };

  const buyQuantity = Math.min(Math.max(quantity || 1, 1), 5);
  const totalCost = item.price * buyQuantity;
  const user = await getUser(userId, guildId);

  if (user.wallet < totalCost) {
    return { error: `You need ${fmt(totalCost)} to buy that. Your wallet: ${fmt(user.wallet)}` };
  }

  user.wallet -= totalCost;
  for (let index = 0; index < buyQuantity; index += 1) {
    user.inventory.push(createInventoryItemFromStore(item));
  }
  await user.save();

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'store_buy',
    amount: totalCost,
    currency: 'wallet',
    metadata: { itemId: item.id, quantity: buyQuantity },
  });

  return { item, totalCost, user, buyQuantity };
}

module.exports = {
  name: 'store',
  aliases: ['shop', 'itemstore'],
  description: 'Browse and buy items from the underground store.',
  usage: '<browse|inspect|buy> ...',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('store')
    .setDescription('Browse and buy items from the underground store')
    .addSubcommand((s) => s.setName('browse').setDescription('Browse the store'))
    .addSubcommand((s) =>
      s
        .setName('inspect')
        .setDescription('Inspect a store item')
        .addStringOption((o) => o.setName('item').setDescription('Store item ID').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('buy')
        .setDescription('Buy a store item')
        .addStringOption((o) => o.setName('item').setDescription('Store item ID').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('quantity').setDescription('How many to buy').setRequired(false).setMinValue(1).setMaxValue(5),
        ),
    ),

  async execute({ message, args }) {
    const sub = (args[0] || 'browse').toLowerCase();

    if (sub === 'browse') {
      return message.reply({ embeds: [buildBrowseEmbed()] });
    }

    if (sub === 'inspect') {
      const item = getStoreItem(args[1]);
      if (!item) return message.reply({ embeds: [embed.error('That store item does not exist.')] });
      return message.reply({ embeds: [buildInspectEmbed(item)] });
    }

    if (sub === 'buy') {
      const result = await handleBuy(message.author.id, message.guild.id, args[1], parseInt(args[2], 10) || 1);
      if (result.error) return message.reply({ embeds: [embed.error(result.error)] });
      return message.reply({
        embeds: [
          embed.success(
            'Purchase Complete',
            `You bought **${result.item.name}** x${result.buyQuantity} for ${fmt(result.totalCost)}.\n\nNew wallet: ${fmt(result.user.wallet)}`,
          ),
        ],
      });
    }

    return message.reply({ embeds: [embed.error('Usage: `.store <browse|inspect|buy>`')] });
  },

  async executeSlash({ interaction }) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'browse') {
      return interaction.reply({ embeds: [buildBrowseEmbed()] });
    }

    if (sub === 'inspect') {
      const item = getStoreItem(interaction.options.getString('item'));
      if (!item)
        return interaction.reply({ embeds: [embed.error('That store item does not exist.')], ephemeral: true });
      return interaction.reply({ embeds: [buildInspectEmbed(item)] });
    }

    if (sub === 'buy') {
      const result = await handleBuy(
        interaction.user.id,
        interaction.guild.id,
        interaction.options.getString('item'),
        interaction.options.getInteger('quantity') || 1,
      );
      if (result.error) return interaction.reply({ embeds: [embed.error(result.error)], ephemeral: true });
      return interaction.reply({
        embeds: [
          embed.success(
            'Purchase Complete',
            `You bought **${result.item.name}** x${result.buyQuantity} for ${fmt(result.totalCost)}.\n\nNew wallet: ${fmt(result.user.wallet)}`,
          ),
        ],
      });
    }
  },
};

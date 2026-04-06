const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');

function findInventoryEntry(inventory, query) {
  if (!query) return null;

  const asIndex = parseInt(query, 10);
  if (!isNaN(asIndex) && asIndex >= 1 && asIndex <= inventory.length) {
    return inventory[asIndex - 1];
  }

  return inventory.find(item => item.name.toLowerCase() === query.toLowerCase());
}

const run = async ({ userId, guildId, query, reply }) => {
  const user = await getUser(userId, guildId);
  const inventory = [...(user.inventory || [])]
    .filter(item => item.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!inventory.length) {
    return reply({ embeds: [embed.info('Inventory Inspect', 'Your inventory is empty.')] });
  }

  const item = findInventoryEntry(inventory, query);
  if (!item) {
    return reply({ embeds: [embed.error('That item was not found in your inventory. Use `inventory` to see your item names or slot numbers.')] });
  }

  const detailsEmbed = embed.raw(0x2b2d31)
    .setTitle(`Inventory Item: ${item.name}`)
    .setDescription(item.description || 'No description.')
    .addFields(
      { name: 'Quantity', value: `${item.quantity}`, inline: true },
      { name: 'Estimated Value', value: item.estimatedValue ? fmt(item.estimatedValue) : 'Unknown', inline: true },
      { name: 'Source', value: item.source || 'Unknown', inline: true }
    );

  if (item.acquiredAt) {
    detailsEmbed.setFooter({ text: `Acquired ${new Date(item.acquiredAt).toLocaleString()}` });
  }

  return reply({ embeds: [detailsEmbed] });
};

module.exports = {
  name: 'inv-inspect',
  aliases: ['inspectitem', 'iteminfo', 'item'],
  description: 'Inspect an item in your inventory.',
  usage: '<item-name|slot-number>',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('inv-inspect')
    .setDescription('Inspect an item in your inventory')
    .addStringOption(o => o.setName('item').setDescription('Item name or slot number from inventory').setRequired(true)),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      query: args.join(' '),
      reply: data => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      query: interaction.options.getString('item'),
      reply: data => interaction.reply(data),
    });
  },
};

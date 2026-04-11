const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser } = require('../../utils/economy');

const PAGE_SIZE = 12;

const run = async ({ userId, guildId, targetUser, page, reply }) => {
  const user = await getUser(userId, guildId);
  const inventory = [...(user.inventory || [])]
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!inventory.length) {
    const owner = targetUser ? `${targetUser.username} has` : 'You have';
    return reply({ embeds: [embed.info('Inventory', `${owner} no items in inventory.`)] });
  }

  const totalPages = Math.max(1, Math.ceil(inventory.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const pageItems = inventory.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);

  const description = pageItems
    .map((item, index) => {
      const details = [];
      if (item.rarity) details.push(item.rarity);
      if (item.kind === 'chicken' && item.stats) {
        details.push(`STR ${item.stats.strength || 0}`);
        details.push(`SPD ${item.stats.speed || 0}`);
        details.push(`GRT ${item.stats.grit || 0}`);
      }
      if (item.estimatedValue) details.push(`est. ${item.estimatedValue.toLocaleString()}`);
      if (item.description)
        details.push(item.description.length > 40 ? `${item.description.slice(0, 40)}...` : item.description);
      return `**${(safePage - 1) * PAGE_SIZE + index + 1}.** ${item.name} x${item.quantity}${details.length ? ` - ${details.join(' | ')}` : ''}`;
    })
    .join('\n');

  const inventoryEmbed = embed
    .raw(0x2b2d31)
    .setTitle(targetUser ? `${targetUser.username}'s Inventory` : 'Your Inventory')
    .setDescription(description)
    .setFooter({
      text: `Page ${safePage}/${totalPages} | ${inventory.length} item stack(s) | ${totalQuantity} total item(s)`,
    });

  return reply({ embeds: [inventoryEmbed] });
};

module.exports = {
  name: 'inventory',
  aliases: ['inv', 'items'],
  description: "View your inventory or another user's inventory.",
  usage: '[user] [page] - use `inv-inspect` and `inv-sell` for item actions',
  category: 'blackmarket',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View inventory')
    .addUserOption((o) => o.setName('user').setDescription('User to inspect').setRequired(false))
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)),

  async execute({ message, args }) {
    const target = message.mentions.users.first();
    const filteredArgs = args.filter((arg) => !arg.startsWith('<@'));
    const page = parseInt(filteredArgs[0], 10) || 1;

    return run({
      userId: target ? target.id : message.author.id,
      guildId: message.guild.id,
      targetUser: target,
      page,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    const target = interaction.options.getUser('user');
    return run({
      userId: target ? target.id : interaction.user.id,
      guildId: interaction.guild.id,
      targetUser: target,
      page: interaction.options.getInteger('page') || 1,
      reply: (data) => interaction.reply(data),
    });
  },
};

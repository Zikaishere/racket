const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');

const PAGE_SIZE = 5;

const run = async ({ userId, guildId, targetUser, page, reply }) => {
  const user = await getUser(userId, guildId);
  const history = user.heistHistory || [];

  if (!history.length) {
    const owner = targetUser ? `${targetUser.username} has` : 'You have';
    return reply({ embeds: [embed.info('Heist History', `${owner} no heist history yet.`)] });
  }

  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const pageItems = history.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const lines = pageItems.map((entry, index) => {
    const number = (safePage - 1) * PAGE_SIZE + index + 1;
    const payoutText = entry.payout >= 0 ? `+${fmt(entry.payout)}` : `-${fmt(Math.abs(entry.payout))}`;
    return `**${number}.** ${entry.target} - ${entry.outcome.toUpperCase()} - **${entry.role}** - ${payoutText}\nStrategy: ${entry.strategy} | Heat: ${entry.heatLevel}`;
  });

  const historyEmbed = embed
    .raw(0x2b2d31)
    .setTitle(targetUser ? `${targetUser.username}'s Heist History` : 'Your Heist History')
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `Page ${safePage}/${totalPages} | ${history.length} recorded heist(s)` });

  return reply({ embeds: [historyEmbed] });
};

module.exports = {
  name: 'heisthistory',
  aliases: ['hhistory', 'hist'],
  description: 'View your past heists and outcomes.',
  usage: '[user] [page]',
  category: 'heist',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('heisthistory')
    .setDescription('View heist history')
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

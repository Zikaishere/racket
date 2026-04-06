const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const CasinoManager = require('../../handlers/CasinoManager');

function buildTablesSummary(guildId) {
  const activeTables = CasinoManager.getActiveTables(guildId);
  if (!activeTables.length) {
    return '*No active multiplayer tables right now.*';
  }

  return activeTables.map(table => {
    if (table.game === 'Roulette') {
      const secondsLeft = Math.max(1, Math.ceil((table.expires - Date.now()) / 1000));
      return `**Roulette** - ${table.bets.length} bet(s) placed - spins in ${secondsLeft}s`;
    }

    return `**[${table.id}]** ${table.game} - ${table.players.length} seat(s) filled`;
  }).join('\n');
}

function buildLobbyEmbed(user, guildId) {
  let luckStatus = 'Normal';
  if (user.luck > 1.0) luckStatus = 'Hot Streak';
  if (user.luck < 1.0) luckStatus = 'On Tilt';

  return embed.raw(0x1B1B1B)
    .setTitle('Racket Casino - Grand Lobby')
    .setDescription(`Welcome back to the floor.\n\n**Wallet:** ${fmt(user.balance)}\n**Chips:** **${user.chips.toLocaleString()}**`)
    .addFields(
      { name: 'Rank', value: user.casinoRank, inline: true },
      { name: 'Status', value: `${luckStatus} (x${user.luck})`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Active Tables', value: buildTablesSummary(guildId), inline: false },
      { name: 'Live Feed', value: CasinoManager.getHighlights(guildId), inline: false }
    )
    .setFooter({ text: 'Use the menu below to navigate or type commands like /cashier or /slots' });
}

function buildTablesEmbed(guildId) {
  return embed.raw(0x457B9D)
    .setTitle('Table Games Area')
    .setDescription(`Welcome to the pits.\n\n**Available Tables Right Now**\n${buildTablesSummary(guildId)}\n\n**Open a Table**\n- **Blackjack**: \`/blackjack <bet>\`\n- **Roulette**: \`/roulette <bet> <type>\`\n- **Double or Nothing**: \`/double <bet>\``);
}

function buildNavRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('casino_nav')
      .setPlaceholder('Navigate the Casino...')
      .addOptions([
        { label: 'Grand Lobby', description: 'Return to the main floor', value: 'lobby', emoji: '??' },
        { label: 'Cashier', description: 'Exchange your Raqs to Chips', value: 'cashier', emoji: '??' },
        { label: 'Table Games', description: 'View Blackjack, Roulette, and live tables', value: 'tables', emoji: '??' },
        { label: 'Slots Area', description: 'View Slots and Vault info', value: 'slots', emoji: '??' },
        { label: 'VIP Lounge', description: 'Exclusive perks and high stakes', value: 'vip', emoji: '??' },
      ])
  );
}

const run = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);

  if (user.casinoBanEnds && new Date(user.casinoBanEnds).getTime() > Date.now()) {
    const remaining = Math.ceil((new Date(user.casinoBanEnds).getTime() - Date.now()) / 60000);
    return reply({ embeds: [embed.error(`You are barred from the floor for ${remaining} more minutes due to caught tax evasion.`)], ephemeral: true });
  }

  return reply({ embeds: [buildLobbyEmbed(user, guildId)], components: [buildNavRow()] });
};

module.exports = {
  name: 'lobby',
  aliases: ['casino'],
  description: 'Enter the interactive casino lobby.',
  usage: '',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('lobby')
    .setDescription('Enter the interactive casino lobby'),

  async execute({ message }) {
    return run({ userId: message.author.id, guildId: message.guild.id, reply: data => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({ userId: interaction.user.id, guildId: interaction.guild.id, reply: data => interaction.reply(data) });
  },

  async handleNav(interaction) {
    const selected = interaction.values[0];
    const user = await getUser(interaction.user.id, interaction.guild.id);
    let lobbyEmbed;

    if (selected === 'lobby') {
      lobbyEmbed = buildLobbyEmbed(user, interaction.guild.id);
    } else if (selected === 'cashier') {
      lobbyEmbed = embed.raw(0x2DC653)
        .setTitle('Casino Cashier')
        .setDescription('"Looking to buy chips or cash out?"\n\n- **Buy Chips**: \`/cashier buy <amount>\`\n- **Cash Out**: \`/cashier cashout <amount>\`\n\nCashouts above 5,000 chips are taxed unless you try to evade it.');
    } else if (selected === 'tables') {
      lobbyEmbed = buildTablesEmbed(interaction.guild.id);
    } else if (selected === 'slots') {
      lobbyEmbed = embed.raw(0xFFB703)
        .setTitle('Slots and Arcade Area')
        .setDescription('Flashing lights and bad decisions everywhere.\n\n- **Slots**: \`/slots <bet>\`\n- **Vault Crack**: \`/vault <bet>\`');
    } else if (selected === 'vip') {
      if (!['VIP', 'Whale'].includes(user.casinoRank)) {
        return interaction.reply({ embeds: [embed.error('You must be at least **VIP** rank to enter the lounge.')] , ephemeral: true });
      }
      lobbyEmbed = embed.raw(0x7209B7)
        .setTitle('VIP Lounge')
        .setDescription(`Welcome back, ${user.casinoRank}.\n\nHigh stakes, cleaner drinks, and fewer questions asked.`);
    }

    await interaction.update({ embeds: [lobbyEmbed], components: [buildNavRow()] });
  },
};
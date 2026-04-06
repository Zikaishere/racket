const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const CasinoManager = require('../../handlers/CasinoManager');

const run = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);

  if (user.casinoBanEnds && new Date(user.casinoBanEnds).getTime() > Date.now()) {
    const remaining = Math.ceil((new Date(user.casinoBanEnds).getTime() - Date.now()) / 60000);
    return reply({ embeds: [embed.error('🚫 Casino Ban', `You are barred from the floor for ${remaining} more minutes due to caught tax evasion.`)], ephemeral: true });
  }

  const activeTables = CasinoManager.getActiveTables(guildId);
  const tablesText = activeTables.length > 0
    ? activeTables.map(t => `**[${t.id}]** ${t.game} (${t.players.length} playing)`).join('\n')
    : '*No active multiplayer tables right now.*';

  let luckStr = '🍀 Normal';
  if (user.luck > 1.0) luckStr = '🔥 Hot Streak';
  if (user.luck < 1.0) luckStr = '😵 On Tilt';

  const e = embed.raw(0x1B1B1B)
    .setTitle('🎰 Racket Casino — Grand Lobby')
    .setDescription(`Welcome back to the floor.\n\n**Wallet:** ${fmt(user.balance)}\n**Chips:** 🎰 **${user.chips.toLocaleString()}**`)
    .addFields(
      { name: '🎖️ Rank', value: user.casinoRank, inline: true },
      { name: 'Status', value: `${luckStr} (x${user.luck})`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🎲 Active Tables', value: tablesText, inline: false },
      { name: '📺 Live Feed', value: CasinoManager.getHighlights(guildId), inline: false },
    )
    .setFooter({ text: 'Use the menu below to navigate or type commands like /cashier or /slots' });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('casino_nav')
      .setPlaceholder('Navigate the Casino...')
      .addOptions([
        { label: 'Grand Lobby', description: 'Return to the main floor', value: 'lobby', emoji: '🎰' },
        { label: 'Cashier', description: 'Exchange your Raqs to Chips', value: 'cashier', emoji: '💵' },
        { label: 'Table Games', description: 'View Blackjack & Roulette info', value: 'tables', emoji: '🃏' },
        { label: 'Slots Area', description: 'View Slots & Arcade info', value: 'slots', emoji: '🍒' },
        { label: 'VIP Lounge', description: 'Exclusive perks & High stakes', value: 'vip', emoji: '💎' },
      ])
  );

  return reply({ embeds: [e], components: [row] });
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
    return run({ userId: message.author.id, guildId: message.guild.id, reply: (d) => message.reply(d) });
  },

  async executeSlash({ interaction }) {
    return run({ userId: interaction.user.id, guildId: interaction.guild.id, reply: (d) => interaction.reply(d) });
  },

  // Navigation Logic
  async handleNav(interaction) {
    const val = interaction.values[0];
    const user = await getUser(interaction.user.id, interaction.guild.id);
    let e;

    if (val === 'lobby') {
      const activeTables = CasinoManager.getActiveTables(interaction.guild.id);
      const tablesText = activeTables.length > 0
        ? activeTables.map(t => `**[${t.id}]** ${t.game} (${t.players.length} playing)`).join('\n')
        : '*No active multiplayer tables right now.*';
      
      let luckStr = '🍀 Normal';
      if (user.luck > 1.0) luckStr = '🔥 Hot Streak';
      if (user.luck < 1.0) luckStr = '😵 On Tilt';

      e = embed.raw(0x1B1B1B)
        .setTitle('🎰 Racket Casino — Grand Lobby')
        .setDescription(`Welcome back to the floor.\n\n**Wallet:** ${fmt(user.balance)}\n**Chips:** 🎰 **${user.chips.toLocaleString()}**`)
        .addFields(
          { name: '🎖️ Rank', value: user.casinoRank, inline: true },
          { name: 'Status', value: `${luckStr} (x${user.luck})`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '🎲 Active Tables', value: tablesText, inline: false },
          { name: '📺 Live Feed', value: CasinoManager.getHighlights(interaction.guild.id), inline: false },
        );
    } else if (val === 'cashier') {
      e = embed.raw(0x2DC653)
        .setTitle('💵 Casino Cashier')
        .setDescription(`"Hey there. Looking to buy some chips or cash out?"\n\n- **Buy Chips**: \`/cashier buy <amount>\`\n- **Cash Out**: \`/cashier cashout <amount>\`\n\n*Note: Cashouts above 5,000 chips are subject to a 5% Syndicate tax. You can attempt to \`--evade\` it, but don't get caught.*`);
    } else if (val === 'tables') {
      e = embed.raw(0x457B9D)
        .setTitle('🃏 Table Games Area')
        .setDescription(`Welcome to the pits. Place your bets.\n\n- **Blackjack**: \`/blackjack <bet>\` to open a table and let others join!\n- **Roulette**: \`/roulette\` drop bets on a public timer!\n- **Double or Nothing**: \`/double <bet>\` Flip the coin continuously until you lose it all or walk away rich!`);
    } else if (val === 'slots') {
      e = embed.raw(0xFFB703)
        .setTitle('🍒 Slots & Arcade Area')
        .setDescription(`Deafening chimes and flashing lights fill the room...\n\n- **Slots**: \`/slots <bet>\` Animated slot machine pulling.\n- **Vault Crack**: \`/vault <bet>\` Push your luck cracking doors. Don't trip the alarm!`);
    } else if (val === 'vip') {
      if (!['VIP', 'Whale'].includes(user.casinoRank)) {
        return interaction.reply({ embeds: [embed.error('🛑 Bouncers stopped you', 'You must be at least **VIP** rank to enter the lounge. Wager more chips on the main floor!')], ephemeral: true });
      }
      e = embed.raw(0x7209B7)
        .setTitle('💎 VIP Lounge')
        .setDescription(`"Welcome back, ${user.casinoRank}. Champagne?"\n\nIn this exclusive room, betting limits are massive, the drinks are free, and luck rules are bent slightly in your favor.\n\n*Use normal commands here, the floor limits automatically adapt to your rank.*`);
    }

    // Attempt to update the original message, it keeps the select menu
    await interaction.update({ embeds: [e] });
  }
};

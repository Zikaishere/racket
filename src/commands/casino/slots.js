const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const { reserveFunds, settleReservation } = require('../../utils/gameFunds');
const { logAudit } = require('../../utils/audit');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');
const CasinoManager = require('../../handlers/CasinoManager');

const SYMBOLS = [
  { name: 'Cherry', icon: '🍒' },
  { name: 'Lemon', icon: '🍋' },
  { name: 'Bell', icon: '🔔' },
  { name: 'Diamond', icon: '💎' },
  { name: 'Seven', icon: '7️⃣' },
  { name: 'Card', icon: '🃏' },
];
const PAYOUTS = {
  Seven: 10,
  Diamond: 7,
  Bell: 5,
  Cherry: 3,
  Lemon: 2,
  Card: 1.5,
};

const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

function calculateSlotsWin(reels, bet) {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    const multiplier = PAYOUTS[a] || 2;
    return {
      result: 'jackpot',
      netProfit: Math.floor(bet * multiplier),
      totalReturn: bet + Math.floor(bet * multiplier),
    };
  } else if (a === b || b === c || a === c) {
    return { result: 'two_of_kind', netProfit: Math.floor(bet * 0.5), totalReturn: bet + Math.floor(bet * 0.5) };
  }
  return { result: 'loss', netProfit: -bet, totalReturn: 0 };
}

const run = async ({ userId, guildId, username, bet, reply, editReply }) => {
  if (isNaN(bet) || bet < CASINO_MIN_BET || bet > CASINO_MAX_BET) {
    return reply({
      embeds: [embed.error(`Bet must be between ${fmt(CASINO_MIN_BET)} and ${fmt(CASINO_MAX_BET)}.`)],
      ephemeral: true,
    });
  }

  const user = await getUser(userId, guildId);
  if (user.chips < bet) {
    return reply({
      embeds: [embed.error(`You don't have enough chips. Chips: **${user.chips.toLocaleString()}**`)],
      ephemeral: true,
    });
  }

  const gameKey = `slots:${userId}:${Date.now()}`;
  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'slots',
    gameKey,
    currency: 'chips',
    amount: bet,
    metadata: { username, bet },
  });

  if (!reserved) {
    return reply({
      embeds: [embed.error(`You don't have enough chips. Chips: **${user.chips.toLocaleString()}**`)],
      ephemeral: true,
    });
  }

  const reels = [spin(), spin(), spin()];
  const [a, b, c] = reels;
  const machineEmbed = embed
    .raw(0x1b1b1b)
    .setTitle('Slot Machine')
    .setDescription('[ ? | ? | ? ]\n\nSpinning...')
    .addFields({ name: 'Bet', value: fmt(bet), inline: true });

  const message = await reply({ embeds: [machineEmbed] });
  if (!message) return;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(1200);
  machineEmbed.setDescription(`[ ${a.icon} | ? | ? ]\n\nSpinning...`);
  await editReply(message, { embeds: [machineEmbed] });

  await delay(1200);
  machineEmbed.setDescription(`[ ${a.icon} | ${b.icon} | ? ]\n\nSpinning...`);
  await editReply(message, { embeds: [machineEmbed] });

  await delay(1200);

  let netProfit = -bet;
  let totalReturn = 0;
  let resultText = '';

  if (a.name === b.name && b.name === c.name) {
    const multiplier = PAYOUTS[a.name] || 2;
    netProfit = Math.floor(bet * multiplier);
    totalReturn = bet + netProfit;
    resultText = `Jackpot. All three ${a.icon} match. You won **${netProfit.toLocaleString()}** chips.`;
  } else if (a.name === b.name || b.name === c.name || a.name === c.name) {
    netProfit = Math.floor(bet * 0.5);
    totalReturn = bet + netProfit;
    resultText = `Two of a kind. You won **${netProfit.toLocaleString()}** chips.`;
  } else {
    resultText = `No match. You lost **${bet.toLocaleString()}** chips.`;
  }

  const finalUser = await getUser(userId, guildId);
  finalUser.chips += totalReturn;
  await finalUser.save();
  await settleReservation({ userId, guildId, gameKey, currency: 'chips' });
  await recordGame(userId, guildId, totalReturn > 0, bet);
  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'slots_spin',
    amount: netProfit,
    currency: 'chips',
    metadata: { bet, reels },
  });

  if (netProfit >= bet * 5) {
    CasinoManager.addHighlight(
      guildId,
      `**${username}** hit the slot jackpot and won **${netProfit.toLocaleString()}** chips.`,
    );
  }

  machineEmbed
    .setColor(totalReturn > 0 ? 0x2dc653 : 0xff6b6b)
    .setDescription(`[ ${a.icon} | ${b.icon} | ${c.icon} ]\n\n${resultText}`)
    .addFields({ name: 'New Chips', value: `**${finalUser.chips.toLocaleString()}**`, inline: true });

  await editReply(message, { embeds: [machineEmbed] });
};

module.exports = {
  SYMBOLS,
  PAYOUTS,
  calculateSlotsWin,
  name: 'slots',
  aliases: ['slot', 'spin'],
  description: 'Spin the slot machine.',
  usage: '<bet>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spin the slot machine')
    .addIntegerOption((o) =>
      o
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(CASINO_MIN_BET)
        .setMaxValue(CASINO_MAX_BET),
    ),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      bet: parseInt(args[0], 10),
      reply: async (data) => message.reply(data),
      editReply: async (_message, data) => _message.edit(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      bet: interaction.options.getInteger('bet'),
      reply: async (data) => interaction.reply({ ...data, fetchReply: true }),
      editReply: async (_message, data) => interaction.editReply(data),
    });
  },
};

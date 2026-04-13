const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const CasinoManager = require('../../handlers/CasinoManager');
const { reserveFunds, settleReservationsByGameKey } = require('../../utils/gameFunds');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');

const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const _BLACK = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function getColor(number) {
  if (number === 0) return 'green';
  if (RED.includes(number)) return 'red';
  return 'black';
}

const BET_TYPES = {
  red: { check: (number) => getColor(number) === 'red', payout: 2, label: 'Red' },
  black: { check: (number) => getColor(number) === 'black', payout: 2, label: 'Black' },
  odd: { check: (number) => number !== 0 && number % 2 !== 0, payout: 2, label: 'Odd' },
  even: { check: (number) => number !== 0 && number % 2 === 0, payout: 2, label: 'Even' },
  low: { check: (number) => number >= 1 && number <= 18, payout: 2, label: 'Low (1-18)' },
  high: { check: (number) => number >= 19 && number <= 36, payout: 2, label: 'High (19-36)' },
};

const resolveRoulette = async (client, guildId) => {
  const table = CasinoManager.getTable(guildId, 'roulette');
  if (!table) return;

  CasinoManager.deleteTable(guildId, 'roulette');

  const result = Math.floor(Math.random() * 37);
  const color = getColor(result);
  const colorLabel = color.charAt(0).toUpperCase() + color.slice(1);
  let resultsText = `The ball landed on **${result} (${colorLabel})**.\n\n`;
  let biggestWinner = null;

  for (const betEntry of table.bets) {
    const user = await getUser(betEntry.userId, guildId);
    const won = betEntry.isNumber
      ? result === parseInt(betEntry.betType, 10)
      : BET_TYPES[betEntry.betType].check(result);

    const profit = won
      ? betEntry.isNumber
        ? betEntry.bet * 35
        : betEntry.bet * (BET_TYPES[betEntry.betType].payout - 1)
      : 0;
    const totalReturn = won ? betEntry.bet + profit : 0;

    user.chips += totalReturn;
    await user.save();
    await recordGame(betEntry.userId, guildId, won, betEntry.bet);

    if (won) {
      resultsText += `**${betEntry.username}** won **${totalReturn.toLocaleString()}** chips (${betEntry.betLabel})\n`;
      if (!biggestWinner || profit > biggestWinner.payout) {
        biggestWinner = { name: betEntry.username, payout: profit };
      }
    } else {
      resultsText += `**${betEntry.username}** lost **${betEntry.bet.toLocaleString()}** chips (${betEntry.betLabel})\n`;
    }
  }

  await settleReservationsByGameKey(table.gameKey);

  if (biggestWinner && biggestWinner.payout >= 10000) {
    CasinoManager.addHighlight(
      guildId,
      `**${biggestWinner.name}** won big on Roulette for **${biggestWinner.payout.toLocaleString()}** chips.`,
    );
  }

  const resultEmbed = embed.raw(0x457b9d).setTitle('Roulette Results').setDescription(resultsText);

  const channel = client.channels.cache.get(table.channelId);
  if (channel) {
    channel.send({ embeds: [resultEmbed] });
  }
};

const run = async ({ userId, guildId, username, channelId, client, bet, betType, reply }) => {
  const normalizedBetType = String(betType).toLowerCase();
  const isNumber =
    !isNaN(normalizedBetType) && parseInt(normalizedBetType, 10) >= 0 && parseInt(normalizedBetType, 10) <= 36;
  const isType = BET_TYPES[normalizedBetType];

  if (!isNumber && !isType) {
    return reply({
      embeds: [embed.error('Invalid bet type. Use: red, black, odd, even, low, high, or a number 0-36.')],
      ephemeral: true,
    });
  }

  if (isNaN(bet) || bet < CASINO_MIN_BET || bet > CASINO_MAX_BET) {
    return reply({
      embeds: [embed.error(`Bet must be between ${fmt(CASINO_MIN_BET)} and ${fmt(CASINO_MAX_BET)}.`)],
      ephemeral: true,
    });
  }

  const user = await getUser(userId, guildId);
  if (user.chips < bet) {
    return reply({ embeds: [embed.error("You don't have enough chips.")], ephemeral: true });
  }

  let table = CasinoManager.getTable(guildId, 'roulette');
  if (!table) {
    const gameKey = `roulette:${guildId}:${Date.now()}`;
    table = {
      game: 'Roulette',
      channelId,
      players: [],
      bets: [],
      expires: Date.now() + 30000,
      gameKey,
    };
    CasinoManager.addTable(guildId, 'roulette', table);
    setTimeout(() => resolveRoulette(client, guildId), 30000);
  }

  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'roulette',
    gameKey: table.gameKey,
    currency: 'chips',
    amount: bet,
    metadata: { betType: normalizedBetType, username },
  });

  if (!reserved) {
    return reply({ embeds: [embed.error("You don't have enough chips.")], ephemeral: true });
  }

  if (!table.players.includes(userId)) table.players.push(userId);

  const betLabel = isNumber ? `Number ${normalizedBetType}` : BET_TYPES[normalizedBetType].label;
  table.bets.push({ userId, username, bet, betType: normalizedBetType, isNumber, betLabel });

  const remaining = Math.max(1, Math.ceil((table.expires - Date.now()) / 1000));
  return reply({
    embeds: [
      embed.success(
        'Bet Placed',
        `**${username}** placed **${bet.toLocaleString()}** chips on **${betLabel}**.\n\nThe wheel spins in ${remaining} seconds.`,
      ),
    ],
  });
};

module.exports = {
  name: 'roulette',
  aliases: ['rou'],
  description: 'Bet on the active roulette table. Wheel spins every 30s.',
  usage: '<bet> <red|black|odd|even|low|high|number>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Bet on the active roulette table')
    .addIntegerOption((o) =>
      o
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(CASINO_MIN_BET)
        .setMaxValue(CASINO_MAX_BET),
    )
    .addStringOption((o) =>
      o.setName('type').setDescription('red, black, odd, even, low, high, or a number 0-36').setRequired(true),
    ),

  async execute({ message, args, client }) {
    if (!args[0] || !args[1]) return message.reply({ embeds: [embed.error('Usage: `.roulette <bet> <type>`')] });
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      channelId: message.channel.id,
      client,
      bet: parseInt(args[0], 10),
      betType: args[1],
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction, client }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      channelId: interaction.channelId,
      client,
      bet: interaction.options.getInteger('bet'),
      betType: interaction.options.getString('type'),
      reply: (data) => interaction.reply(data),
    });
  },
};

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const CasinoManager = require('../../handlers/CasinoManager');
const { reserveFunds, refundReservation, settleReservationsByGameKey } = require('../../utils/gameFunds');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');

const SUITS = ['♠️', '♥️', '♣️', '♦️'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const HOUSE_BOT_ID = 'house-bot';

function newDeck() {
  const deck = [];
  for (let i = 0; i < 4; i += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank, 10);
}

function handValue(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card.rank), 0);
  let aces = hand.filter((card) => card.rank === 'A').length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function formatHand(hand, hideSecond = false) {
  return hand.map((card, index) => (hideSecond && index === 1 ? '🂠' : `${card.rank}${card.suit}`)).join(' ');
}

function maybeAddHouseBot(table) {
  if (table.players.length === 1) {
    table.players.push({ id: HOUSE_BOT_ID, username: 'House Bot', hand: [], state: 'waiting', isBot: true });
  }
}

const renderLobby = (table) =>
  embed
    .raw(0x457b9d)
    .setTitle(`Blackjack Table [${table.tableId}]`)
    .setDescription(
      `**${table.players[0].username}** opened a Blackjack table.\n\nBet: ${table.bet.toLocaleString()} chips\nPlayers (${table.players.length}/5):\n${table.players.map((player) => `- ${player.username}`).join('\n')}`,
    )
    .setFooter({
      text: 'Other players can join, or the host can start early. If nobody joins, the House Bot will sit in.',
    });

const buildLobbyButtons = (tableId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_join_${tableId}`).setLabel('Join Table').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bj_leave_${tableId}`).setLabel('Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`bj_start_${tableId}`).setLabel('Start Now').setStyle(ButtonStyle.Primary),
  );

const buildTurnButtons = (tableId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${tableId}`).setLabel('Hit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${tableId}`).setLabel('Stand').setStyle(ButtonStyle.Secondary),
  );

const renderTable = (table, hideDealer = true) => {
  const tableEmbed = embed.raw(0x457b9d).setTitle(`Blackjack Table [${table.tableId}]`);

  if (table.status === 'done') {
    tableEmbed.setDescription('Game Over').setColor(0x2dc653);
    tableEmbed.addFields({
      name: `Dealer (${handValue(table.dealerHand)})`,
      value: formatHand(table.dealerHand),
      inline: false,
    });
  } else {
    tableEmbed.setDescription(`Bet: ${table.bet.toLocaleString()} chips`).setColor(0xffb703);
    tableEmbed.addFields({ name: 'Dealer', value: formatHand(table.dealerHand, hideDealer), inline: false });
  }

  for (let index = 0; index < table.players.length; index += 1) {
    const player = table.players[index];
    const marker = index === table.currentPlayerIndex && table.status === 'playing' ? '-> ' : '';
    let statusText = player.state === 'playing' ? 'Thinking...' : player.state.toUpperCase();
    if (player.state === 'blackjack') statusText = 'BLACKJACK';
    if (player.state === 'bust') statusText = 'BUST';
    if (player.isBot && player.state === 'playing') statusText = 'BOT PLAYING';

    tableEmbed.addFields({
      name: `${marker}${player.username} (${handValue(player.hand)}) - ${statusText}`,
      value: formatHand(player.hand) || 'Waiting...',
      inline: false,
    });
  }

  return tableEmbed;
};

const sendTurnPrompt = async (interaction, table) => {
  const player = table.players[table.currentPlayerIndex];
  const tableEmbed = renderTable(table);
  const turnText = player.isBot
    ? `${player.username} is taking a turn.`
    : `<@${player.id}>, it is your turn. Hit or Stand?`;
  tableEmbed.addFields({ name: 'Turn', value: turnText });
  await interaction.update({ embeds: [tableEmbed], components: [player.isBot ? [] : buildTurnButtons(table.tableId)] });
};

const finishGame = async (interaction, table) => {
  table.status = 'done';
  CasinoManager.deleteTable(table.guildId, table.tableId);

  let dealerValue = handValue(table.dealerHand);
  while (dealerValue < 17) {
    table.dealerHand.push(table.deck.pop());
    dealerValue = handValue(table.dealerHand);
  }

  for (const player of table.players) {
    if (player.isBot) continue;

    const user = await getUser(player.id, table.guildId);
    let won = false;
    let push = false;

    if (player.state === 'blackjack') {
      won = true;
      user.chips += Math.floor(table.bet * 2.5);
    } else if (player.state === 'bust') {
      won = false;
    } else {
      const playerValue = handValue(player.hand);
      if (dealerValue > 21 || playerValue > dealerValue) {
        won = true;
        user.chips += table.bet * 2;
      } else if (playerValue === dealerValue) {
        push = true;
        user.chips += table.bet;
      }
    }

    await user.save();
    if (!push) {
      await recordGame(player.id, table.guildId, won, table.bet);
    }

    if (won && player.state === 'blackjack' && table.bet >= 10000) {
      CasinoManager.addHighlight(table.guildId, `**${player.username}** hit a natural blackjack and won big.`);
    }
  }

  await settleReservationsByGameKey(table.gameKey);
  await interaction.update({ embeds: [renderTable(table, false)], components: [] });
};

const runBotTurn = async (interaction, table) => {
  const bot = table.players[table.currentPlayerIndex];
  if (!bot?.isBot) return false;

  while (handValue(bot.hand) < 17) {
    bot.hand.push(table.deck.pop());
    if (handValue(bot.hand) > 21) {
      bot.state = 'bust';
      return true;
    }
  }

  if (handValue(bot.hand) === 21 && bot.hand.length === 2) {
    bot.state = 'blackjack';
  } else {
    bot.state = 'stand';
  }

  return true;
};

const nextTurn = async (interaction, table) => {
  table.currentPlayerIndex += 1;
  if (table.currentPlayerIndex >= table.players.length) {
    return finishGame(interaction, table);
  }

  const nextPlayer = table.players[table.currentPlayerIndex];
  if (nextPlayer.state !== 'playing') {
    return nextTurn(interaction, table);
  }

  if (nextPlayer.isBot) {
    await runBotTurn(interaction, table);
    return nextTurn(interaction, table);
  }

  return sendTurnPrompt(interaction, table);
};

const run = async ({ userId, guildId, username, bet, reply }) => {
  if (isNaN(bet) || bet < CASINO_MIN_BET || bet > CASINO_MAX_BET) {
    return reply({
      embeds: [embed.error(`Bet must be between ${fmt(CASINO_MIN_BET)} and ${fmt(CASINO_MAX_BET)}.`)],
      ephemeral: true,
    });
  }

  const user = await getUser(userId, guildId);
  if (user.chips < bet) {
    return reply({
      embeds: [embed.error(`You do not have enough chips. Chips: ${user.chips.toLocaleString()}`)],
      ephemeral: true,
    });
  }

  const tableId = CasinoManager.createTableId();
  const gameKey = `blackjack:${guildId}:${tableId}`;
  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'blackjack',
    gameKey,
    currency: 'chips',
    amount: bet,
    metadata: { username, tableId },
  });

  if (!reserved) {
    return reply({
      embeds: [embed.error(`You do not have enough chips. Chips: ${user.chips.toLocaleString()}`)],
      ephemeral: true,
    });
  }

  const table = {
    game: 'Blackjack',
    tableId,
    gameKey,
    guildId,
    hostId: userId,
    bet,
    players: [{ id: userId, username, hand: [], state: 'waiting' }],
    status: 'lobby',
    deck: newDeck(),
    dealerHand: [],
    currentPlayerIndex: 0,
  };

  CasinoManager.addTable(guildId, tableId, table);
  return reply({ embeds: [renderLobby(table)], components: [buildLobbyButtons(tableId)] });
};

const handleButton = async (interaction) => {
  const [, action, tableId] = interaction.customId.split('_');
  const table = CasinoManager.getTable(interaction.guild.id, tableId);

  if (!table) {
    return interaction.reply({ embeds: [embed.error('This table has expired or already finished.')], ephemeral: true });
  }

  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (action === 'join') {
    if (table.status !== 'lobby')
      return interaction.reply({ embeds: [embed.error('Game already started.')], ephemeral: true });
    if (table.players.some((player) => player.id === userId))
      return interaction.reply({ embeds: [embed.error('You are already at this table.')], ephemeral: true });
    if (table.players.length >= 5)
      return interaction.reply({ embeds: [embed.error('Table is full.')], ephemeral: true });

    const user = await getUser(userId, table.guildId);
    if (user.chips < table.bet) {
      return interaction.reply({
        embeds: [embed.error(`You need ${table.bet.toLocaleString()} chips to join.`)],
        ephemeral: true,
      });
    }

    const reserved = await reserveFunds({
      userId,
      guildId: table.guildId,
      game: 'blackjack',
      gameKey: table.gameKey,
      currency: 'chips',
      amount: table.bet,
      metadata: { username, tableId },
    });

    if (!reserved) {
      return interaction.reply({
        embeds: [embed.error(`You need ${table.bet.toLocaleString()} chips to join.`)],
        ephemeral: true,
      });
    }

    table.players.push({ id: userId, username, hand: [], state: 'waiting' });
    return interaction.update({ embeds: [renderLobby(table)], components: [buildLobbyButtons(tableId)] });
  }

  if (action === 'leave') {
    if (table.status !== 'lobby')
      return interaction.reply({
        embeds: [embed.error('You cannot leave while the game is running.')],
        ephemeral: true,
      });
    const playerIndex = table.players.findIndex((player) => player.id === userId);
    if (playerIndex === -1)
      return interaction.reply({ embeds: [embed.error('You are not at this table.')], ephemeral: true });

    await refundReservation({ userId, guildId: table.guildId, gameKey: table.gameKey, currency: 'chips' });
    table.players.splice(playerIndex, 1);

    if (table.players.length === 0) {
      CasinoManager.deleteTable(table.guildId, tableId);
      return interaction.update({
        embeds: [embed.info('Table Closed', 'The table closed and the reserved bet was refunded.')],
        components: [],
      });
    }

    if (userId === table.hostId) {
      table.hostId = table.players[0].id;
    }

    return interaction.update({ embeds: [renderLobby(table)], components: [buildLobbyButtons(tableId)] });
  }

  if (action === 'start') {
    if (userId !== table.hostId)
      return interaction.reply({ embeds: [embed.error('Only the host can start the game.')], ephemeral: true });
    if (table.status !== 'lobby')
      return interaction.reply({ embeds: [embed.error('Game already started.')], ephemeral: true });

    maybeAddHouseBot(table);
    table.status = 'playing';
    table.dealerHand.push(table.deck.pop(), table.deck.pop());

    for (const player of table.players) {
      player.hand.push(table.deck.pop(), table.deck.pop());
      player.state = handValue(player.hand) === 21 ? 'blackjack' : 'playing';
    }

    while (
      table.currentPlayerIndex < table.players.length &&
      table.players[table.currentPlayerIndex].state !== 'playing'
    ) {
      table.currentPlayerIndex += 1;
    }

    if (table.currentPlayerIndex >= table.players.length) {
      return finishGame(interaction, table);
    }

    if (table.players[table.currentPlayerIndex].isBot) {
      await runBotTurn(interaction, table);
      return nextTurn(interaction, table);
    }

    return sendTurnPrompt(interaction, table);
  }

  const currentPlayer = table.players[table.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== userId) {
    return interaction.reply({ embeds: [embed.error('It is not your turn.')], ephemeral: true });
  }

  if (action === 'hit') {
    currentPlayer.hand.push(table.deck.pop());
    if (handValue(currentPlayer.hand) > 21) {
      currentPlayer.state = 'bust';
      return nextTurn(interaction, table);
    }
    return sendTurnPrompt(interaction, table);
  }

  if (action === 'stand') {
    currentPlayer.state = 'stand';
    return nextTurn(interaction, table);
  }
};

module.exports = {
  name: 'blackjack',
  aliases: ['bj', '21'],
  description: 'Create a multiplayer Blackjack table.',
  usage: 'create <bet>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Create a multiplayer Blackjack table')
    .addIntegerOption((o) =>
      o
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(CASINO_MIN_BET)
        .setMaxValue(CASINO_MAX_BET),
    ),

  async execute({ message, args }) {
    if (args[0] && args[0].toLowerCase() === 'create') args.shift();
    if (!args[0]) return message.reply({ embeds: [embed.error('Usage: `.blackjack create <bet>`')] });
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      bet: parseInt(args[0], 10),
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      bet: interaction.options.getInteger('bet'),
      reply: (data) => interaction.reply(data),
    });
  },

  handleButton,
};

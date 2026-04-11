const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const CasinoManager = require('../../handlers/CasinoManager');
const { reserveFunds, settleReservation } = require('../../utils/gameFunds');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');

const activeGames = new Map();

function buildButtons(takeValue, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('double_flip')
      .setLabel('Double Again')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('double_take')
      .setLabel(`Take ${takeValue.toLocaleString()} chips`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
  );
}

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
      embeds: [embed.error(`You don't have enough chips. Chips: ${user.chips.toLocaleString()}`)],
      ephemeral: true,
    });
  }

  if (activeGames.has(userId)) {
    return reply({
      embeds: [embed.error('You already have an active Double or Nothing game running!')],
      ephemeral: true,
    });
  }

  const gameKey = `double:${userId}`;
  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'double',
    gameKey,
    currency: 'chips',
    amount: bet,
    metadata: { username, originalBet: bet },
  });

  if (!reserved) {
    return reply({
      embeds: [embed.error(`You don't have enough chips. Chips: ${user.chips.toLocaleString()}`)],
      ephemeral: true,
    });
  }

  activeGames.set(userId, { guildId, pool: bet, originalBet: bet, username, flips: 0, gameKey });
  await handleFlip(userId, null, reply);
};

const handleFlip = async (userId, interaction, replyFn) => {
  const game = activeGames.get(userId);
  if (!game) return;

  const user = await getUser(userId, game.guildId);
  game.flips += 1;

  const chance = 0.5 * user.luck;
  const isWin = Math.random() < chance;

  if (isWin) {
    game.pool *= 2;
    const successEmbed = embed
      .raw(0x2dc653)
      .setTitle('Double or Nothing')
      .setDescription(
        `The coin landed on Heads.\n\nCurrent Pool: ${game.pool.toLocaleString()} chips\n\nDo you want to keep going?`,
      )
      .setFooter({ text: `Flips won: ${game.flips}` });

    if (interaction) await interaction.update({ embeds: [successEmbed], components: [buildButtons(game.pool)] });
    else await replyFn({ embeds: [successEmbed], components: [buildButtons(game.pool)] });
    return;
  }

  activeGames.delete(userId);
  await settleReservation({ userId, guildId: game.guildId, gameKey: game.gameKey, currency: 'chips' });
  await recordGame(userId, game.guildId, false, game.originalBet);

  const loseEmbed = embed
    .raw(0xff6b6b)
    .setTitle('Double or Nothing')
    .setDescription(
      `The coin landed on Tails. You lost the pool.\n\nTotal Lost: ${game.originalBet.toLocaleString()} chips`,
    )
    .setFooter({ text: `Lost on flip ${game.flips}` });

  if (interaction) await interaction.update({ embeds: [loseEmbed], components: [buildButtons(0, true)] });
  else await replyFn({ embeds: [loseEmbed], components: [buildButtons(0, true)] });
};

const handleTake = async (interaction) => {
  const userId = interaction.user.id;
  const game = activeGames.get(userId);
  if (!game) return interaction.reply({ embeds: [embed.error('No active game.')], ephemeral: true });

  const user = await getUser(userId, game.guildId);
  user.chips += game.pool;
  await user.save();
  await settleReservation({ userId, guildId: game.guildId, gameKey: game.gameKey, currency: 'chips' });
  await recordGame(userId, game.guildId, true, game.originalBet);

  if (game.pool >= game.originalBet * 8) {
    CasinoManager.addHighlight(
      game.guildId,
      `**${game.username}** chained ${game.flips} flips in Double or Nothing and cashed out ${game.pool.toLocaleString()} chips.`,
    );
  }

  activeGames.delete(userId);

  const takeEmbed = embed
    .raw(0x2dc653)
    .setTitle('Double or Nothing')
    .setDescription(
      `You cashed out safely.\n\nYou walked away with ${game.pool.toLocaleString()} chips.\nNew Chips: ${user.chips.toLocaleString()}`,
    )
    .setFooter({ text: `Cashed out after ${game.flips} flips` });

  return interaction.update({ embeds: [takeEmbed], components: [buildButtons(game.pool, true)] });
};

module.exports = {
  name: 'double',
  aliases: ['don'],
  description: 'Play Double or Nothing. Risk it all for big chips!',
  usage: '<bet>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('double')
    .setDescription('Play Double or Nothing. Risk it all for big chips!')
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

  async handleButton(interaction) {
    if (interaction.customId === 'double_flip') {
      return handleFlip(interaction.user.id, interaction, null);
    }

    if (interaction.customId === 'double_take') {
      return handleTake(interaction);
    }
  },
};

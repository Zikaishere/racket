const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const CasinoManager = require('../../handlers/CasinoManager');
const { reserveFunds, settleReservation } = require('../../utils/gameFunds');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');

const activeGames = new Map();
const MULTIPLIERS = [1.2, 1.5, 2.0, 3.5, 5.0, 10.0];
const ALARM_CHANCE = [0.1, 0.2, 0.35, 0.5, 0.65, 0.85];

function buildButtons(takeValue, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vault_crack')
      .setLabel('Crack Lock')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('vault_take')
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
    return reply({ embeds: [embed.error('You are already trying to crack a vault!')], ephemeral: true });
  }

  const gameKey = `vault:${userId}`;
  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'vault',
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

  activeGames.set(userId, { guildId, pool: bet, originalBet: bet, username, level: 0, gameKey });

  const introEmbed = embed
    .raw(0x457b9d)
    .setTitle('Vault Crack')
    .setDescription(
      `You slip into the vault corridor.\n\nLevel: 1\nPotential Pool: ${Math.floor(bet * MULTIPLIERS[0]).toLocaleString()} chips\n\nCrack the first lock or walk away?`,
    );

  return reply({ embeds: [introEmbed], components: [buildButtons(bet)] });
};

const handleCrack = async (interaction) => {
  const userId = interaction.user.id;
  const game = activeGames.get(userId);
  if (!game) return interaction.reply({ embeds: [embed.error('No active vault game.')], ephemeral: true });

  const user = await getUser(userId, game.guildId);
  const level = game.level;
  if (level >= MULTIPLIERS.length) {
    return interaction.reply({
      embeds: [embed.error('You already beat the highest level. Take the money!')],
      ephemeral: true,
    });
  }

  const chance = Math.max(0.01, ALARM_CHANCE[level] * (1 / user.luck));
  const tripped = Math.random() < chance;

  if (tripped) {
    activeGames.delete(userId);
    await settleReservation({ userId, guildId: game.guildId, gameKey: game.gameKey, currency: 'chips' });
    await recordGame(userId, game.guildId, false, game.originalBet);

    const bustedEmbed = embed
      .raw(0xff6b6b)
      .setTitle('Busted')
      .setDescription(
        `The alarm went off on Door ${level + 1}.\n\nTotal Lost: ${game.originalBet.toLocaleString()} chips`,
      );

    return interaction.update({ embeds: [bustedEmbed], components: [buildButtons(0, true)] });
  }

  game.pool = Math.floor(game.originalBet * MULTIPLIERS[level]);
  game.level += 1;

  if (game.level >= MULTIPLIERS.length) {
    const finalEmbed = embed
      .raw(0xffb703)
      .setTitle('Vault Cracked')
      .setDescription(
        `You disabled the final lock.\n\nPool: ${game.pool.toLocaleString()} chips\n\nThere are no more doors. Take the money and run.`,
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vault_take')
        .setLabel(`Take ${game.pool.toLocaleString()} chips`)
        .setStyle(ButtonStyle.Success),
    );
    return interaction.update({ embeds: [finalEmbed], components: [row] });
  }

  const nextDisplay = Math.floor(game.originalBet * MULTIPLIERS[game.level]);
  const crackEmbed = embed
    .raw(0x457b9d)
    .setTitle('Vault Crack')
    .setDescription(
      `You opened Door ${game.level}.\n\nCurrent Pool: ${game.pool.toLocaleString()} chips\nNext Door Reward: ${nextDisplay.toLocaleString()} chips\n\nTake it, or crack the next lock?`,
    );

  return interaction.update({ embeds: [crackEmbed], components: [buildButtons(game.pool)] });
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

  if (game.level >= 4) {
    CasinoManager.addHighlight(
      game.guildId,
      `**${game.username}** escaped a level ${game.level} vault with ${game.pool.toLocaleString()} chips.`,
    );
  }

  activeGames.delete(userId);

  const safeEmbed = embed
    .raw(0x2dc653)
    .setTitle('Safe Escape')
    .setDescription(
      `You got out clean.\n\nYou walked away with ${game.pool.toLocaleString()} chips.\nNew Chips: ${user.chips.toLocaleString()}`,
    );

  return interaction.update({ embeds: [safeEmbed], components: [buildButtons(game.pool, true)] });
};

module.exports = {
  name: 'vault',
  aliases: ['crack'],
  description: 'Crack vault doors for big multipliers, but do not trip the alarm!',
  usage: '<bet>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('Crack vault doors for multipliers.')
    .addIntegerOption((o) =>
      o
        .setName('bet')
        .setDescription('Amount to risk')
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
    if (interaction.customId === 'vault_crack') {
      return handleCrack(interaction);
    }

    if (interaction.customId === 'vault_take') {
      return handleTake(interaction);
    }
  },
};

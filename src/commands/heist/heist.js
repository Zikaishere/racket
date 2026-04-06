const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const User = require('../../models/User');
const { reserveFunds, refundReservations, settleReservationsByGameKey } = require('../../utils/gameFunds');
const { HEIST_MIN_PLAYERS, HEIST_JOIN_WINDOW, HEIST_MIN_BET, HEIST_MAX_BET } = require('../../config');

const activeHeists = new Map();

const HEIST_TARGETS = [
  { name: 'Corner Store', minCrew: 1, maxCrew: 3, baseReward: 500, successRate: 0.85 },
  { name: 'Bank Branch', minCrew: 2, maxCrew: 5, baseReward: 2000, successRate: 0.65 },
  { name: 'Armored Car', minCrew: 2, maxCrew: 4, baseReward: 5000, successRate: 0.50 },
  { name: 'Casino Vault', minCrew: 3, maxCrew: 6, baseReward: 10000, successRate: 0.40 },
  { name: 'Federal Reserve', minCrew: 4, maxCrew: 8, baseReward: 25000, successRate: 0.25 },
];

const FAIL_OUTCOMES = [
  'The alarm went off before you got inside.',
  'A guard spotted the crew and called the cops.',
  'Someone talked. The whole operation was blown.',
  'The getaway driver panicked and left without you.',
  'An undercover cop was in the crew. Everyone got pinched.',
];

const SUCCESS_OUTCOMES = [
  'Clean getaway. Not a single alarm triggered.',
  'In and out in 3 minutes. Textbook operation.',
  'The inside man came through. Easy money.',
  'Guards were on break. Perfect timing.',
  'Everything went according to plan.',
];

function buildJoinButton(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('heist_join')
      .setLabel('Join Heist')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

const run = async ({ userId, guildId, username, bet, reply }) => {
  if (activeHeists.has(guildId)) {
    return reply({ embeds: [embed.warning('Heist In Progress', 'There is already a heist being planned in this server. Wait for it to finish.')], ephemeral: true });
  }

  if (isNaN(bet) || bet < HEIST_MIN_BET || bet > HEIST_MAX_BET) {
    return reply({ embeds: [embed.error(`Bet must be between ${fmt(HEIST_MIN_BET)} and ${fmt(HEIST_MAX_BET)}.`)], ephemeral: true });
  }

  const user = await getUser(userId, guildId);
  if (user.balance < bet) {
    return reply({ embeds: [embed.error(`You don't have enough raqs. Balance: ${fmt(user.balance)}`)], ephemeral: true });
  }

  const target = HEIST_TARGETS[Math.min(Math.floor(bet / 2000), HEIST_TARGETS.length - 1)];
  const gameKey = `heist:${guildId}:${Date.now()}`;
  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'heist',
    gameKey,
    currency: 'balance',
    amount: bet,
    metadata: { username, target: target.name },
  });

  if (!reserved) {
    return reply({ embeds: [embed.error(`You don't have enough raqs. Balance: ${fmt(user.balance)}`)], ephemeral: true });
  }

  const heist = {
    leaderId: userId,
    guildId,
    target,
    bet,
    crew: new Map([[userId, { bet, username }]]),
    startTime: Date.now(),
    gameKey,
  };

  activeHeists.set(guildId, heist);

  const timeLeft = HEIST_JOIN_WINDOW / 1000;
  const planningEmbed = embed.raw(0xE63946)
    .setTitle(`Heist Planning - ${target.name}`)
    .setDescription(`<@${userId}> is planning a heist on the **${target.name}**.\n\nClick **Join Heist** to join the crew. Entry bet: ${fmt(bet)}\n\nLaunches in **${timeLeft} seconds**.`)
    .addFields(
      { name: 'Target', value: target.name, inline: true },
      { name: 'Entry Bet', value: fmt(bet), inline: true },
      { name: 'Crew', value: '1 member', inline: true }
    );

  const message = await reply({ embeds: [planningEmbed], components: [buildJoinButton()], fetchReply: true });

  setTimeout(async () => {
    const currentHeist = activeHeists.get(guildId);
    if (!currentHeist) return;
    activeHeists.delete(guildId);

    const crewSize = currentHeist.crew.size;
    const crewList = [...currentHeist.crew.keys()].map(id => `<@${id}>`).join(', ');

    if (crewSize < HEIST_MIN_PLAYERS) {
      await refundReservations({ gameKey: currentHeist.gameKey });
      const refundEmbed = embed.warning('Heist Cancelled', `Not enough crew members joined. Need at least ${HEIST_MIN_PLAYERS}. All bets were refunded.`);
      return message.edit({ embeds: [refundEmbed], components: [buildJoinButton(true)] });
    }

    const crewBonus = Math.min((crewSize - 1) * 0.05, 0.2);
    const successChance = currentHeist.target.successRate + crewBonus;
    const success = Math.random() < successChance;

    if (success) {
      const totalPot = currentHeist.bet * crewSize;
      const reward = Math.floor((totalPot + currentHeist.target.baseReward) / crewSize);
      const outcome = SUCCESS_OUTCOMES[Math.floor(Math.random() * SUCCESS_OUTCOMES.length)];

      for (const [memberId] of currentHeist.crew) {
        const member = await getUser(memberId, guildId);
        member.balance += reward;
        member.stats.heistsJoined += 1;
        member.stats.heistsWon += 1;
        await member.save();
      }

      await settleReservationsByGameKey(currentHeist.gameKey);

      const winEmbed = embed.raw(0x2DC653)
        .setTitle(`Heist Success - ${currentHeist.target.name}`)
        .setDescription(`*"${outcome}"*\n\nThe crew pulled it off. Each member takes home ${fmt(reward)}.`)
        .addFields(
          { name: 'Crew', value: crewList },
          { name: 'Each Earned', value: fmt(reward), inline: true },
          { name: 'Target', value: currentHeist.target.name, inline: true }
        );

      return message.edit({ embeds: [winEmbed], components: [buildJoinButton(true)] });
    }

    const outcome = FAIL_OUTCOMES[Math.floor(Math.random() * FAIL_OUTCOMES.length)];
    for (const [memberId] of currentHeist.crew) {
      const member = await User.findOrCreate(memberId, guildId);
      member.stats.heistsJoined += 1;
      await member.save();
    }

    await settleReservationsByGameKey(currentHeist.gameKey);

    const loseEmbed = embed.raw(0xFF6B6B)
      .setTitle(`Heist Failed - ${currentHeist.target.name}`)
      .setDescription(`*"${outcome}"*\n\nThe crew lost everything. Better luck next time.`)
      .addFields(
        { name: 'Crew', value: crewList },
        { name: 'Lost', value: fmt(currentHeist.bet), inline: true },
        { name: 'Target', value: currentHeist.target.name, inline: true }
      );

    return message.edit({ embeds: [loseEmbed], components: [buildJoinButton(true)] });
  }, HEIST_JOIN_WINDOW);
};

module.exports = {
  name: 'heist',
  aliases: ['crew', 'raid'],
  description: 'Plan a heist and invite others to join your crew.',
  usage: '<bet>',
  category: 'heist',
  guildOnly: true,
  activeHeists,

  slash: new SlashCommandBuilder()
    .setName('heist')
    .setDescription('Plan a heist and invite others to join your crew')
    .addIntegerOption(o => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(HEIST_MIN_BET).setMaxValue(HEIST_MAX_BET)),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      bet: parseInt(args[0], 10),
      reply: data => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      bet: interaction.options.getInteger('bet'),
      reply: data => interaction.reply({ ...data, fetchReply: true }),
    });
  },

  async handleJoin(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const heist = activeHeists.get(guildId);

    if (!heist) return interaction.reply({ embeds: [embed.error('This heist is no longer active.')], ephemeral: true });
    if (heist.crew.has(userId)) return interaction.reply({ embeds: [embed.error('You are already in this heist.')], ephemeral: true });

    const user = await getUser(userId, guildId);
    if (user.balance < heist.bet) {
      return interaction.reply({ embeds: [embed.error(`You do not have enough raqs to join. Need: ${fmt(heist.bet)}`)], ephemeral: true });
    }

    const reserved = await reserveFunds({
      userId,
      guildId,
      game: 'heist',
      gameKey: heist.gameKey,
      currency: 'balance',
      amount: heist.bet,
      metadata: { username: interaction.user.username, target: heist.target.name },
    });

    if (!reserved) {
      return interaction.reply({ embeds: [embed.error(`You do not have enough raqs to join. Need: ${fmt(heist.bet)}`)], ephemeral: true });
    }

    heist.crew.set(userId, { bet: heist.bet, username: interaction.user.username });

    const updateEmbed = embed.raw(0xE63946)
      .setTitle(`Heist Planning - ${heist.target.name}`)
      .setDescription(`<@${heist.leaderId}> is planning a heist on the **${heist.target.name}**.\n\nClick **Join Heist** to join the crew. Entry bet: ${fmt(heist.bet)}\n\nLaunching soon.`)
      .addFields(
        { name: 'Target', value: heist.target.name, inline: true },
        { name: 'Entry Bet', value: fmt(heist.bet), inline: true },
        { name: 'Crew', value: `${heist.crew.size} members`, inline: true },
        { name: 'Members', value: [...heist.crew.keys()].map(id => `<@${id}>`).join(', ') }
      );

    await interaction.update({ embeds: [updateEmbed], components: [buildJoinButton()] });
    await interaction.followUp({ content: `<@${userId}> joined the heist.`, ephemeral: false });
  },
};

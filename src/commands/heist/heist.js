const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const _User = require('../../models/User');
const Crew = require('../../models/Crew');
const { reserveFunds, refundReservations, settleReservationsByGameKey } = require('../../utils/gameFunds');
const {
  HEIST_MIN_PLAYERS,
  HEIST_JOIN_WINDOW,
  HEIST_MIN_BET,
  HEIST_MAX_BET,
  HEIST_BASE_COOLDOWN,
  WANTED_DURATION,
} = require('../../config');

const activeHeists = new Map();
const HEIST_TARGETS = [
  { name: 'Corner Store', minCrew: 1, maxCrew: 3, baseReward: 500, successRate: 0.85, heat: 0 },
  { name: 'Bank Branch', minCrew: 2, maxCrew: 5, baseReward: 2000, successRate: 0.65, heat: 1 },
  { name: 'Armored Car', minCrew: 2, maxCrew: 4, baseReward: 5000, successRate: 0.5, heat: 2 },
  { name: 'Casino Vault', minCrew: 3, maxCrew: 6, baseReward: 10000, successRate: 0.4, heat: 2 },
  { name: 'Federal Reserve', minCrew: 4, maxCrew: 8, baseReward: 25000, successRate: 0.25, heat: 3 },
];

const STRATEGIES = {
  quiet: {
    label: 'Quiet',
    successMod: 0.1,
    rewardMod: -0.15,
    heatMod: -1,
    failText: 'The crew stayed cautious, which kept the worst of the chaos down.',
  },
  balanced: {
    label: 'Balanced',
    successMod: 0,
    rewardMod: 0,
    heatMod: 0,
    failText: 'The crew played it straight, but the job still went south.',
  },
  aggressive: {
    label: 'Aggressive',
    successMod: -0.12,
    rewardMod: 0.25,
    heatMod: 1,
    failText: 'The aggressive push got loud fast, and the police hit back hard.',
  },
};

const ENTRY_POINTS = [
  {
    name: 'Front Entrance',
    successMod: -0.05,
    rewardMod: 0.1,
    heatMod: 1,
    reveal: 'Front Entrance was high-visibility. The score was bigger, but security reacted faster.',
  },
  {
    name: 'Back Alley',
    successMod: 0.05,
    rewardMod: 0,
    heatMod: 0,
    reveal: 'Back Alley gave the crew cleaner access and fewer surprises.',
  },
  {
    name: 'Roof Access',
    successMod: 0.02,
    rewardMod: 0.05,
    heatMod: -1,
    reveal: 'Roof Access kept some heat off the crew, but the route was slower and awkward.',
  },
];

const HEAT_LEVELS = [
  {
    name: 'Low Heat',
    cooldownMs: 0,
    seizureRate: 0,
    description: 'The crew lost the entry bet and slipped away before the city locked down.',
  },
  {
    name: 'Medium Heat',
    cooldownMs: 30 * 60 * 1000,
    seizureRate: 0,
    description: 'The police flooded the area and everyone had to disappear for a while.',
  },
  {
    name: 'High Heat',
    cooldownMs: 2 * 60 * 60 * 1000,
    seizureRate: 0.12,
    description: 'The city cracked down hard, and wallets got seized on top of the loss.',
  },
  {
    name: 'Busted',
    cooldownMs: 6 * 60 * 60 * 1000,
    seizureRate: 0.25,
    description: 'The crew got properly caught. Long cooldowns and heavy seizures followed.',
  },
];

const ROLE_POOL = [
  { name: 'Enforcer', weight: 24 },
  { name: 'Hacker', weight: 18 },
  { name: 'Driver', weight: 18 },
  { name: 'Lookout', weight: 18 },
  { name: 'Inside Man', weight: 6 },
];

const SUCCESS_OUTCOMES = [
  'Clean getaway. Not a single alarm triggered.',
  'In and out in minutes. Textbook execution.',
  'The inside setup held and the crew moved like clockwork.',
  'Security blinked first. The crew was gone before anyone understood what happened.',
];

const FAIL_OUTCOMES = [
  'The alarm tripped before the crew could settle in.',
  'A patrol route crossed the wrong hallway at the worst possible time.',
  'Someone got seen, and the whole plan unraveled at once.',
  'The getaway route jammed up and police closed in fast.',
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function pickRole(existingCrew) {
  const pool = ROLE_POOL.filter(
    (role) => role.name !== 'Inside Man' || ![...existingCrew.values()].some((member) => member.role === 'Inside Man'),
  );
  const totalWeight = pool.reduce((sum, role) => sum + role.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const role of pool) {
    roll -= role.weight;
    if (roll <= 0) return role.name;
  }

  return 'Driver';
}

function getRemainingMs(targetDate) {
  if (!targetDate) return 0;
  return Math.max(0, new Date(targetDate).getTime() - Date.now());
}

function buildControls(heist, disabled = false) {
  const strategyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('heist_strategy_quiet')
      .setLabel('Quiet')
      .setStyle(heist.strategy === 'quiet' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('heist_strategy_balanced')
      .setLabel('Balanced')
      .setStyle(heist.strategy === 'balanced' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('heist_strategy_aggressive')
      .setLabel('Aggressive')
      .setStyle(heist.strategy === 'aggressive' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(disabled),
  );

  const entryRow = new ActionRowBuilder().addComponents(
    ...heist.entryOptions.map((entry, index) =>
      new ButtonBuilder()
        .setCustomId(`heist_entry_${index}`)
        .setLabel(entry.name)
        .setStyle(heist.selectedEntryIndex === index ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(disabled),
    ),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('heist_join').setLabel('Join').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('heist_scope')
      .setLabel(heist.scoped ? 'Scoped' : 'Scope +15s')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || heist.scoped),
    new ButtonBuilder()
      .setCustomId('heist_launch')
      .setLabel('Launch')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );

  return [strategyRow, entryRow, actionRow];
}

function buildCrewList(heist) {
  return [...heist.crew.entries()]
    .map(([memberId, member]) => `<@${memberId}> - **${member.role}**${member.crewName ? ` (${member.crewName})` : ''}`)
    .join('\n');
}

function buildPlanningEmbed(heist) {
  const strategy = STRATEGIES[heist.strategy];
  const entry = heist.entryOptions[heist.selectedEntryIndex];
  const secondsLeft = Math.max(1, Math.ceil((heist.launchAt - Date.now()) / 1000));

  return embed
    .raw(0xe63946)
    .setTitle(`Heist Planning - ${heist.target.name}`)
    .setDescription(
      `<@${heist.leaderId}> is planning a heist on the **${heist.target.name}**.\n\nLeader can change strategy, rotate the entry point, or scope the place out before launch.`,
    )
    .addFields(
      { name: 'Target', value: heist.target.name, inline: true },
      { name: 'Entry Bet', value: fmt(heist.bet), inline: true },
      { name: 'Crew Size', value: `${heist.crew.size}/${heist.target.maxCrew}`, inline: true },
      { name: 'Strategy', value: strategy.label, inline: true },
      { name: 'Entry Point', value: entry.name, inline: true },
      { name: 'Launch In', value: `${secondsLeft}s`, inline: true },
      { name: 'Permanent Crew', value: heist.crewName || 'No registered crew', inline: true },
      { name: 'Crew Roles', value: buildCrewList(heist), inline: false },
    )
    .setFooter({
      text: heist.scoped
        ? 'The crew scoped the target and earned a small success bonus.'
        : 'Scope adds 15 seconds and a small success bonus.',
    });
}

function appendHeistHistory(user, entry) {
  user.heistHistory = [entry, ...(user.heistHistory || [])].slice(0, 15);
}

async function editHeistMessage(heist, payload) {
  if (!heist.message) return;
  await heist.message.edit(payload).catch(() => {});
}

function scheduleLaunch(heist, client) {
  if (heist.timeout) clearTimeout(heist.timeout);
  heist.timeout = setTimeout(
    () => {
      resolveHeist(heist.guildId, client).catch((error) => console.error('Heist resolution failed:', error));
    },
    Math.max(0, heist.launchAt - Date.now()),
  );
}

function getRoleBonuses(heist) {
  const roles = [...heist.crew.values()].map((member) => member.role);
  const counts = roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  let successBonus = 0.08; // Mastermind baseline
  if (counts.Enforcer) successBonus += counts.Enforcer * 0.04;
  if (counts.Hacker) successBonus += 0.14 + Math.max(0, counts.Hacker - 1) * 0.04;
  if (counts.Driver) successBonus += counts.Driver * 0.03;
  if (counts.Lookout) successBonus += counts.Lookout * 0.03;
  if (counts['Inside Man']) successBonus += 0.22;

  const permanentCrewMembers = heist.crewId
    ? [...heist.crew.values()].filter((member) => member.crewId === heist.crewId).length
    : 0;
  const crewSynergyBonus = Math.min(0.15, Math.max(0, permanentCrewMembers - 1) * 0.03);
  successBonus += crewSynergyBonus;

  return { counts, successBonus, crewSynergyBonus };
}

async function resolveHeist(guildId, _client) {
  const heist = activeHeists.get(guildId);
  if (!heist) return;
  activeHeists.delete(guildId);
  if (heist.timeout) clearTimeout(heist.timeout);

  const now = Date.now();
  const entry = heist.entryOptions[heist.selectedEntryIndex];
  const strategy = STRATEGIES[heist.strategy];
  const crewEntries = [...heist.crew.entries()];
  const crewList = crewEntries.map(([memberId]) => `<@${memberId}>`).join(', ');

  if (heist.crew.size < Math.max(HEIST_MIN_PLAYERS, heist.target.minCrew)) {
    await refundReservations({ gameKey: heist.gameKey });
    const cancelEmbed = embed
      .warning(
        'Heist Cancelled',
        `Not enough crew members joined. This target needs at least ${Math.max(HEIST_MIN_PLAYERS, heist.target.minCrew)} players.`,
      )
      .addFields({ name: 'Crew', value: crewList || 'Nobody held their nerve.' });
    await editHeistMessage(heist, { embeds: [cancelEmbed], components: buildControls(heist, true) });
    return;
  }

  const roleBonuses = getRoleBonuses(heist);
  const successChance = clamp(
    heist.target.successRate +
      strategy.successMod +
      entry.successMod +
      roleBonuses.successBonus +
      (heist.scoped ? 0.05 : 0),
    0.05,
    0.95,
  );

  const success = Math.random() < successChance;

  if (success) {
    const totalPot = heist.bet * heist.crew.size;
    const totalReward = Math.max(
      heist.bet,
      Math.floor((totalPot + heist.target.baseReward) * (1 + strategy.rewardMod + entry.rewardMod)),
    );
    const weights = crewEntries.reduce((sum, [, member]) => sum + (member.role === 'Mastermind' ? 1.35 : 1), 0);
    const outcome = SUCCESS_OUTCOMES[Math.floor(Math.random() * SUCCESS_OUTCOMES.length)];

    const payoutLines = [];
    for (const [memberId, member] of crewEntries) {
      const weight = member.role === 'Mastermind' ? 1.35 : 1;
      const payout = Math.max(1, Math.floor(totalReward * (weight / weights)));
      const user = await getUser(memberId, guildId);
      user.wallet += payout;
      user.stats.heistsJoined += 1;
      user.stats.heistsWon += 1;
      user.heistCooldownUntil = new Date(now + HEIST_BASE_COOLDOWN);
      appendHeistHistory(user, {
        target: heist.target.name,
        outcome: 'success',
        role: member.role,
        payout,
        strategy: strategy.label,
        heatLevel: 'None',
        createdAt: new Date(),
      });
      await user.save();
      payoutLines.push(`<@${memberId}> - **${member.role}** - ${fmt(payout)}`);
    }

    await settleReservationsByGameKey(heist.gameKey);

    const successEmbed = embed
      .raw(0x2dc653)
      .setTitle(`Heist Success - ${heist.target.name}`)
      .setDescription(
        `*"${outcome}"*\n\nStrategy: **${strategy.label}**\nEntry: **${entry.name}**\nRevealed Modifier: ${entry.reveal}`,
      )
      .addFields(
        { name: 'Crew', value: crewList, inline: false },
        { name: 'Payouts', value: payoutLines.join('\n'), inline: false },
        { name: 'Final Success Rate', value: `${Math.round(successChance * 100)}%`, inline: true },
        { name: 'Scoped Bonus', value: heist.scoped ? 'Yes (+5%)' : 'No', inline: true },
        {
          name: 'Role Synergy',
          value: `Hacker: ${roleBonuses.counts.Hacker || 0}, Driver: ${roleBonuses.counts.Driver || 0}, Lookout: ${roleBonuses.counts.Lookout || 0}`,
          inline: true,
        },
        {
          name: 'Crew Synergy',
          value: heist.crewName ? `${Math.round(roleBonuses.crewSynergyBonus * 100)}% from ${heist.crewName}` : 'None',
          inline: true,
        },
      );

    await editHeistMessage(heist, { embeds: [successEmbed], components: buildControls(heist, true) });
    return;
  }

  let severityIndex = clamp(heist.target.heat + strategy.heatMod + entry.heatMod, 0, HEAT_LEVELS.length - 1);
  if (roleBonuses.counts.Lookout) severityIndex = Math.max(0, severityIndex - 1);

  const heat = HEAT_LEVELS[severityIndex];
  const failOutcome = FAIL_OUTCOMES[Math.floor(Math.random() * FAIL_OUTCOMES.length)];
  const penaltyLines = [];

  for (const [memberId, member] of crewEntries) {
    const user = await getUser(memberId, guildId);
    user.stats.heistsJoined += 1;

    let refund = 0;
    let seizure = 0;
    let extraLoss = 0;
    let cooldownMs = Math.max(HEIST_BASE_COOLDOWN, heat.cooldownMs);
    let wantedApplied = true;
    let heatLabel = heat.name;

    const driverEscaped = member.role === 'Driver' && Math.random() < 0.4;
    if (driverEscaped) {
      refund = Math.floor(heist.bet * 0.35);
      user.wallet += refund;
      cooldownMs = 0;
      wantedApplied = false;
      heatLabel = `${heat.name} (escaped)`;
    } else {
      seizure = Math.floor(user.wallet * heat.seizureRate);
      if (member.role === 'Enforcer') {
        extraLoss += Math.floor(heist.bet * 0.25);
      }
      if (member.role === 'Inside Man' && severityIndex >= 2) {
        extraLoss += heist.bet;
      }
      const totalPenalty = Math.min(user.wallet, seizure + extraLoss);
      user.wallet = Math.max(0, user.wallet - totalPenalty);
      if (cooldownMs > 0) {
        user.heistCooldownUntil = new Date(now + cooldownMs);
      }
      if (wantedApplied) {
        user.wantedUntil = new Date(now + WANTED_DURATION);
      }
    }

    appendHeistHistory(user, {
      target: heist.target.name,
      outcome: 'fail',
      role: member.role,
      payout: refund - seizure - extraLoss,
      strategy: strategy.label,
      heatLevel: heatLabel,
      createdAt: new Date(),
    });

    await user.save();

    const detailParts = [`**${member.role}**`];
    if (refund > 0) detailParts.push(`refund ${fmt(refund)}`);
    if (seizure > 0) detailParts.push(`seized ${fmt(seizure)}`);
    if (extraLoss > 0) detailParts.push(`extra loss ${fmt(extraLoss)}`);
    if (cooldownMs > 0) detailParts.push(`cooldown ${Math.round(cooldownMs / 60000)}m`);
    if (wantedApplied) detailParts.push('wanted 24h');
    penaltyLines.push(`<@${memberId}> - ${detailParts.join(' | ')}`);
  }

  await settleReservationsByGameKey(heist.gameKey);

  const failEmbed = embed
    .raw(0xff6b6b)
    .setTitle(`Heist Failed - ${heist.target.name}`)
    .setDescription(
      `*"${failOutcome}"*\n\n${strategy.failText}\nEntry: **${entry.name}**\nRevealed Modifier: ${entry.reveal}`,
    )
    .addFields(
      { name: 'Crew', value: crewList, inline: false },
      { name: 'Police Response', value: `**${heat.name}** - ${heat.description}`, inline: false },
      { name: 'Penalties', value: penaltyLines.join('\n'), inline: false },
      { name: 'Final Success Rate', value: `${Math.round(successChance * 100)}%`, inline: true },
      { name: 'Scoped Bonus', value: heist.scoped ? 'Yes (+5%)' : 'No', inline: true },
      {
        name: 'Role Synergy',
        value: `Lookout reduced heat: ${roleBonuses.counts.Lookout ? 'Yes' : 'No'}`,
        inline: true,
      },
      {
        name: 'Crew Synergy',
        value: heist.crewName ? `${Math.round(roleBonuses.crewSynergyBonus * 100)}% from ${heist.crewName}` : 'None',
        inline: true,
      },
    );

  await editHeistMessage(heist, { embeds: [failEmbed], components: buildControls(heist, true) });
}

const run = async ({ userId, guildId, username, bet, reply, client }) => {
  if (activeHeists.has(guildId)) {
    return reply({
      embeds: [
        embed.warning(
          'Heist In Progress',
          'There is already a heist being planned in this server. Wait for it to finish.',
        ),
      ],
      ephemeral: true,
    });
  }

  if (isNaN(bet) || bet < HEIST_MIN_BET || bet > HEIST_MAX_BET) {
    return reply({
      embeds: [embed.error(`Bet must be between ${fmt(HEIST_MIN_BET)} and ${fmt(HEIST_MAX_BET)}.`)],
      ephemeral: true,
    });
  }

  const user = await getUser(userId, guildId);
  const permanentCrew = await Crew.findOne({ guildId, members: userId });
  const cooldownRemaining = getRemainingMs(user.heistCooldownUntil);
  if (cooldownRemaining > 0) {
    return reply({
      embeds: [
        embed.error(
          `You need to cool off before your next heist. Try again in ${Math.ceil(cooldownRemaining / 60000)} minutes.`,
        ),
      ],
      ephemeral: true,
    });
  }

  if (user.wallet < bet) {
    return reply({
      embeds: [embed.error(`You don't have enough raqs. Wallet: ${fmt(user.wallet)}`)],
      ephemeral: true,
    });
  }

  const target = HEIST_TARGETS[Math.min(Math.floor(bet / 2000), HEIST_TARGETS.length - 1)];
  const gameKey = `heist:${guildId}:${Date.now()}`;
  const reserved = await reserveFunds({
    userId,
    guildId,
    game: 'heist',
    gameKey,
    currency: 'wallet',
    amount: bet,
    metadata: { username, target: target.name },
  });

  if (!reserved) {
    return reply({
      embeds: [embed.error(`You don't have enough raqs. Wallet: ${fmt(user.wallet)}`)],
      ephemeral: true,
    });
  }

  const heist = {
    leaderId: userId,
    guildId,
    target,
    bet,
    crew: new Map([
      [
        userId,
        {
          bet,
          username,
          role: 'Mastermind',
          crewId: permanentCrew?._id?.toString() || null,
          crewName: permanentCrew?.name || null,
        },
      ],
    ]),
    crewId: permanentCrew?._id?.toString() || null,
    crewName: permanentCrew?.name || null,
    startTime: Date.now(),
    launchAt: Date.now() + HEIST_JOIN_WINDOW,
    strategy: 'balanced',
    entryOptions: shuffle(ENTRY_POINTS),
    selectedEntryIndex: 0,
    scoped: false,
    gameKey,
    timeout: null,
    message: null,
  };

  activeHeists.set(guildId, heist);
  const message = await reply({
    embeds: [buildPlanningEmbed(heist)],
    components: buildControls(heist, false),
    fetchReply: true,
  });
  heist.message = message;
  scheduleLaunch(heist, client);
};

module.exports = {
  name: 'heist',
  aliases: ['raid'],
  description: 'Plan a heist and invite others to join your crew.',
  usage: '<bet>',
  category: 'heist',
  guildOnly: true,
  activeHeists,

  slash: new SlashCommandBuilder()
    .setName('heist')
    .setDescription('Plan a heist and invite others to join your crew')
    .addIntegerOption((o) =>
      o
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(HEIST_MIN_BET)
        .setMaxValue(HEIST_MAX_BET),
    ),

  async execute({ message, args, client }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      bet: parseInt(args[0], 10),
      reply: (data) => message.reply(data),
      client,
    });
  },

  async executeSlash({ interaction, client: _client }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      bet: interaction.options.getInteger('bet'),
      reply: (data) => interaction.reply({ ...data, fetchReply: true }),
      client: _client,
    });
  },

  async handleButton(interaction, client) {
    const heist = activeHeists.get(interaction.guild.id);
    if (!heist) return interaction.reply({ embeds: [embed.error('This heist is no longer active.')], ephemeral: true });

    const id = interaction.customId;
    const userId = interaction.user.id;

    if (id === 'heist_join') {
      if (heist.crew.has(userId))
        return interaction.reply({ embeds: [embed.error('You are already in this heist.')], ephemeral: true });
      if (heist.crew.size >= heist.target.maxCrew)
        return interaction.reply({
          embeds: [embed.error(`This target only supports ${heist.target.maxCrew} crew members.`)],
          ephemeral: true,
        });

      const user = await getUser(userId, interaction.guild.id);
      const permanentCrew = await Crew.findOne({ guildId: interaction.guild.id, members: userId });
      const cooldownRemaining = getRemainingMs(user.heistCooldownUntil);
      if (cooldownRemaining > 0) {
        return interaction.reply({
          embeds: [
            embed.error(
              `You need to cool off before your next heist. Try again in ${Math.ceil(cooldownRemaining / 60000)} minutes.`,
            ),
          ],
          ephemeral: true,
        });
      }
      if (user.wallet < heist.bet) {
        return interaction.reply({
          embeds: [embed.error(`You do not have enough raqs to join. Need: ${fmt(heist.bet)}`)],
          ephemeral: true,
        });
      }

      const reserved = await reserveFunds({
        userId,
        guildId: interaction.guild.id,
        game: 'heist',
        gameKey: heist.gameKey,
        currency: 'wallet',
        amount: heist.bet,
        metadata: { username: interaction.user.username, target: heist.target.name },
      });

      if (!reserved) {
        return interaction.reply({
          embeds: [embed.error(`You do not have enough raqs to join. Need: ${fmt(heist.bet)}`)],
          ephemeral: true,
        });
      }

      heist.crew.set(userId, {
        bet: heist.bet,
        username: interaction.user.username,
        role: pickRole(heist.crew),
        crewId: permanentCrew?._id?.toString() || null,
        crewName: permanentCrew?.name || null,
      });
      return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
    }

    if (userId !== heist.leaderId) {
      return interaction.reply({
        embeds: [embed.error('Only the heist leader can change the plan.')],
        ephemeral: true,
      });
    }

    if (id.startsWith('heist_strategy_')) {
      heist.strategy = id.replace('heist_strategy_', '');
      return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
    }

    if (id.startsWith('heist_entry_')) {
      heist.selectedEntryIndex = parseInt(id.replace('heist_entry_', ''), 10);
      return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
    }

    if (id === 'heist_scope') {
      if (!heist.scoped) {
        heist.scoped = true;
        heist.launchAt += 15000;
        scheduleLaunch(heist, client);
      }
      return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
    }

    if (id === 'heist_launch') {
      await interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, true) });
      return resolveHeist(interaction.guild.id, client);
    }
  },
};

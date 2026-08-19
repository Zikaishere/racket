const { getUser } = require('../utils/economy');
const { reserveFunds, settleReservationsByGameKey } = require('../utils/gameFunds');
const { HEIST_MIN_PLAYERS, HEIST_BASE_COOLDOWN, WANTED_DURATION } = require('../config');
const { STRATEGIES, HEAT_LEVELS, ROLES, SUCCESS_OUTCOMES, FAIL_OUTCOMES, clamp } = require('./gameData');

function getRoleBonuses(crew) {
  const roles = [...crew.values()].map((m) => m.role);
  const counts = roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  let successBonus = 0;
  if (counts.Mastermind) successBonus += ROLES.Mastermind.successBonus;
  if (counts.Enforcer) successBonus += counts.Enforcer * ROLES.Enforcer.successBonus;
  if (counts.Hacker) successBonus += ROLES.Hacker.successBonus + Math.max(0, counts.Hacker - 1) * 0.04;
  if (counts.Driver) successBonus += counts.Driver * ROLES.Driver.successBonus;
  if (counts.Lookout) successBonus += counts.Lookout * ROLES.Lookout.successBonus;
  if (counts['Inside Man']) successBonus += ROLES['Inside Man'].successBonus;

  const permanentCrewMembers = crew.size > 0
    ? [...crew.values()].filter((m) => m.crewId && m.crewId === crew.values().next().value?.crewId).length
    : 0;
  const crewSynergyBonus = Math.min(0.15, Math.max(0, permanentCrewMembers - 1) * 0.03);
  successBonus += crewSynergyBonus;

  return { counts, successBonus, crewSynergyBonus };
}

function calculateSuccessChance(heist, strategy, entry, roleBonuses) {
  return clamp(
    heist.target.successRate + strategy.successMod + entry.successMod + roleBonuses.successBonus + (heist.scoped ? 0.05 : 0),
    0.05,
    0.95,
  );
}

function calculatePayout(heist, strategy, entry) {
  const totalPot = heist.bet * heist.crew.size;
  return Math.max(
    heist.bet,
    Math.floor((totalPot + heist.target.baseReward) * (1 + strategy.rewardMod + entry.rewardMod)),
  );
}

function calculateHeat(heist, strategy, entry, hasLookout) {
  let severityIndex = clamp(heist.target.heat + strategy.heatMod + entry.heatMod, 0, HEAT_LEVELS.length - 1);
  if (hasLookout) severityIndex = Math.max(0, severityIndex - 1);
  return { severityIndex, heat: HEAT_LEVELS[severityIndex] };
}

async function resolveHeist(guildId, heist, activeHeists) {
  activeHeists.delete(guildId);
  if (heist.timeout) clearTimeout(heist.timeout);

  const now = Date.now();
  const baseCooldownMs = heist.baseCooldownMs || HEIST_BASE_COOLDOWN;
  const entry = heist.entryOptions[heist.selectedEntryIndex];
  const strategy = STRATEGIES[heist.strategy];
  const crewEntries = [...heist.crew.entries()];
  const crewList = crewEntries.map(([id]) => `<@${id}>`).join(', ');

  if (heist.crew.size < Math.max(HEIST_MIN_PLAYERS, heist.target.minCrew)) {
    await reserveFunds ? require('../utils/gameFunds').refundReservations({ gameKey: heist.gameKey }) : null;
    return { type: 'cancelled', crewList, heist, target: heist.target };
  }

  const roleBonuses = getRoleBonuses(heist.crew);
  const successChance = calculateSuccessChance(heist, strategy, entry, roleBonuses);
  const success = Math.random() < successChance;

  if (success) {
    return resolveSuccess(heist, crewEntries, crewList, strategy, entry, roleBonuses, successChance, baseCooldownMs, now, guildId);
  }

  return resolveFailure(heist, crewEntries, crewList, strategy, entry, roleBonuses, successChance, baseCooldownMs, now, guildId);
}

async function resolveSuccess(heist, crewEntries, crewList, strategy, entry, roleBonuses, successChance, baseCooldownMs, now, guildId) {
  const totalReward = calculatePayout(heist, strategy, entry);
  const totalWeight = crewEntries.reduce((sum, [, m]) => sum + (m.role === 'Mastermind' ? 1.35 : 1), 0);
  const outcome = SUCCESS_OUTCOMES[Math.floor(Math.random() * SUCCESS_OUTCOMES.length)];

  const payouts = [];
  for (const [memberId, member] of crewEntries) {
    const weight = member.role === 'Mastermind' ? 1.35 : 1;
    const payout = Math.max(1, Math.floor(totalReward * (weight / totalWeight)));
    const user = await getUser(memberId, guildId);
    user.wallet += payout;
    user.balance = user.wallet;
    user.stats.heistsJoined += 1;
    user.stats.heistsWon += 1;
    user.heistCooldownUntil = new Date(now + baseCooldownMs);
    user.heistHistory = [
      { target: heist.target.name, outcome: 'success', role: member.role, payout, strategy: strategy.label, heatLevel: 'None', createdAt: new Date() },
      ...(user.heistHistory || []),
    ].slice(0, 15);
    await user.save();
    payouts.push({ memberId, role: member.role, payout });
  }

  await settleReservationsByGameKey(heist.gameKey);

  return {
    type: 'success',
    heist,
    crewList,
    strategy,
    entry,
    roleBonuses,
    successChance,
    outcome,
    payouts,
  };
}

async function resolveFailure(heist, crewEntries, crewList, strategy, entry, roleBonuses, successChance, baseCooldownMs, now, guildId) {
  const { heat, severityIndex } = calculateHeat(heist, strategy, entry, roleBonuses.counts.Lookout > 0);
  const outcome = FAIL_OUTCOMES[Math.floor(Math.random() * FAIL_OUTCOMES.length)];

  const penalties = [];
  for (const [memberId, member] of crewEntries) {
    const user = await getUser(memberId, guildId);
    user.stats.heistsJoined += 1;

    let refund = 0;
    let seizure = 0;
    let extraLoss = 0;
    let cooldownMs = Math.max(baseCooldownMs, heat.cooldownMs);
    let wantedApplied = true;
    let escaped = false;

    const driverEscaped = member.role === 'Driver' && Math.random() < 0.4;
    if (driverEscaped) {
      escaped = true;
      refund = Math.floor(heist.bet * 0.35);
      user.wallet += refund;
      user.balance = user.wallet;
      cooldownMs = 0;
      wantedApplied = false;
    } else {
      seizure = Math.floor(user.wallet * heat.seizureRate);
      if (member.role === 'Enforcer') extraLoss += Math.floor(heist.bet * 0.25);
      if (member.role === 'Inside Man' && severityIndex >= 2) extraLoss += heist.bet;
      const totalPenalty = Math.min(user.wallet, seizure + extraLoss);
      user.wallet = Math.max(0, user.wallet - totalPenalty);
      user.balance = user.wallet;
      if (cooldownMs > 0) user.heistCooldownUntil = new Date(now + cooldownMs);
      if (wantedApplied) user.wantedUntil = new Date(now + WANTED_DURATION);
    }

    user.heistHistory = [
      { target: heist.target.name, outcome: 'fail', role: member.role, payout: refund - seizure - extraLoss, strategy: strategy.label, heatLevel: escaped ? `${heat.name} (escaped)` : heat.name, createdAt: new Date() },
      ...(user.heistHistory || []),
    ].slice(0, 15);
    await user.save();

    penalties.push({
      memberId,
      role: member.role,
      escaped,
      refund,
      seizure,
      extraLoss,
      cooldownMs,
      wantedApplied,
      heatLabel: escaped ? `${heat.name} (escaped)` : heat.name,
    });
  }

  await settleReservationsByGameKey(heist.gameKey);

  return {
    type: 'failure',
    heist,
    crewList,
    strategy,
    entry,
    roleBonuses,
    successChance,
    outcome,
    heat,
    penalties,
  };
}

module.exports = {
  getRoleBonuses,
  calculateSuccessChance,
  calculatePayout,
  calculateHeat,
  resolveHeist,
};

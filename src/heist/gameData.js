const HEIST_TARGETS = [
  { name: 'Corner Store', emoji: '🏪', minCrew: 1, maxCrew: 3, baseReward: 500, successRate: 0.85, heat: 0 },
  { name: 'Bank Branch', emoji: '🏦', minCrew: 2, maxCrew: 5, baseReward: 2000, successRate: 0.65, heat: 1 },
  { name: 'Armored Car', emoji: '🚛', minCrew: 2, maxCrew: 4, baseReward: 5000, successRate: 0.5, heat: 2 },
  { name: 'Casino Vault', emoji: '🎰', minCrew: 3, maxCrew: 6, baseReward: 10000, successRate: 0.4, heat: 2 },
  { name: 'Federal Reserve', emoji: '🏛️', minCrew: 4, maxCrew: 8, baseReward: 25000, successRate: 0.25, heat: 3 },
];

const STRATEGIES = {
  quiet: {
    label: 'Quiet',
    emoji: '🤫',
    successMod: 0.1,
    rewardMod: -0.15,
    heatMod: -1,
    description: '+10% success, -15% reward, less heat',
    failText: 'The crew stayed cautious, which kept the worst of the chaos down.',
  },
  balanced: {
    label: 'Balanced',
    emoji: '⚖️',
    successMod: 0,
    rewardMod: 0,
    heatMod: 0,
    description: 'No modifiers',
    failText: 'The crew played it straight, but the job still went south.',
  },
  aggressive: {
    label: 'Aggressive',
    emoji: '🔥',
    successMod: -0.12,
    rewardMod: 0.25,
    heatMod: 1,
    description: '-12% success, +25% reward, more heat',
    failText: 'The aggressive push got loud fast, and the police hit back hard.',
  },
};

const ENTRY_POINTS = [
  {
    name: 'Front Entrance',
    emoji: '🚪',
    successMod: -0.05,
    rewardMod: 0.1,
    heatMod: 1,
    reveal: 'High-visibility entry. Bigger score, but security reacted faster.',
  },
  {
    name: 'Back Alley',
    emoji: ' alley',
    successMod: 0.05,
    rewardMod: 0,
    heatMod: 0,
    reveal: 'Cleaner access with fewer surprises.',
  },
  {
    name: 'Roof Access',
    emoji: '🏠',
    successMod: 0.02,
    rewardMod: 0.05,
    heatMod: -1,
    reveal: 'Kept heat off the crew, but the route was slower.',
  },
];

const HEAT_LEVELS = [
  {
    name: 'Low Heat',
    emoji: '🟢',
    cooldownMs: 0,
    seizureRate: 0,
    description: 'The crew slipped away before the city locked down.',
  },
  {
    name: 'Medium Heat',
    emoji: '🟡',
    cooldownMs: 30 * 60 * 1000,
    seizureRate: 0,
    description: 'The police flooded the area. Everyone had to disappear.',
  },
  {
    name: 'High Heat',
    emoji: '🟠',
    cooldownMs: 2 * 60 * 60 * 1000,
    seizureRate: 0.12,
    description: 'The city cracked down hard. Wallets got seized.',
  },
  {
    name: 'Busted',
    emoji: '🔴',
    cooldownMs: 6 * 60 * 60 * 1000,
    seizureRate: 0.25,
    description: 'Full arrest. Heavy penalties and a long cooldown.',
  },
];

const ROLES = {
  Mastermind: { emoji: '🧠', successBonus: 0.08, payoutWeight: 1.35, description: 'The planner. Earns a bigger cut.' },
  Enforcer: { emoji: '💪', successBonus: 0.04, payoutWeight: 1, description: '+4% success each. Extra 25% bet loss on failure.' },
  Hacker: { emoji: '💻', successBonus: 0.14, payoutWeight: 1, description: '+14% success (first), +4% each extra.' },
  Driver: { emoji: '🚗', successBonus: 0.03, payoutWeight: 1, description: '+3% success. 40% escape chance on failure.' },
  Lookout: { emoji: '👁️', successBonus: 0.03, payoutWeight: 1, description: '+3% success. Reduces heat by 1 tier on failure.' },
  'Inside Man': { emoji: '🕵️', successBonus: 0.22, payoutWeight: 1, description: '+22% success. Max 1. Loses full bet at high heat.' },
};

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
  'Security blinked first. Gone before anyone noticed.',
];

const FAIL_OUTCOMES = [
  'The alarm tripped before the crew could settle in.',
  'A patrol route crossed the wrong hallway at the worst time.',
  'Someone got seen, and the whole plan unraveled.',
  'The getaway route jammed up and police closed in fast.',
];

function pickRole(existingCrew) {
  const pool = ROLE_POOL.filter(
    (role) => role.name !== 'Inside Man' || ![...existingCrew.values()].some((m) => m.role === 'Inside Man'),
  );
  const totalWeight = pool.reduce((sum, role) => sum + role.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const role of pool) {
    roll -= role.weight;
    if (roll <= 0) return role.name;
  }
  return 'Driver';
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTargetForBet(bet) {
  return HEIST_TARGETS[Math.min(Math.floor(bet / 2000), HEIST_TARGETS.length - 1)];
}

module.exports = {
  HEIST_TARGETS,
  STRATEGIES,
  ENTRY_POINTS,
  HEAT_LEVELS,
  ROLES,
  ROLE_POOL,
  SUCCESS_OUTCOMES,
  FAIL_OUTCOMES,
  pickRole,
  shuffle,
  clamp,
  getTargetForBet,
};

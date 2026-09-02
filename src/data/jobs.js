const JOBS = [
  {
    id: 'pickpocket',
    name: 'Pickpocket',
    emoji: '🤏',
    description: 'Work the crowds and lift wallets. Quick reflexes, quick cash.',
    tiers: [
      { name: 'Amateur', salary: 200 },
      { name: 'Prowler', salary: 350 },
      { name: 'Lifter', salary: 550 },
      { name: 'Shadow Fingers', salary: 800 },
    ],
    cooldown: 45 * 60 * 1000,
    requirement: { totalEarned: 0 },
    sector: 'street',
  },
  {
    id: 'street_hustler',
    name: 'Street Hustler',
    emoji: '🗡️',
    description: 'Quick cash on the streets. No formal training needed.',
    tiers: [
      { name: 'Rookie', salary: 300 },
      { name: 'Hustler', salary: 500 },
      { name: 'Seasoned', salary: 800 },
      { name: 'Veteran', salary: 1200 },
    ],
    cooldown: 60 * 60 * 1000,
    requirement: { totalEarned: 0 },
    sector: 'street',
  },
  {
    id: 'courier',
    name: 'Courier',
    emoji: '📦',
    description: 'Move packages from A to B. Nobody asks what is inside.',
    tiers: [
      { name: 'Runner', salary: 350 },
      { name: 'Driver', salary: 550 },
      { name: 'Route Manager', salary: 800 },
      { name: 'Fleet Lead', salary: 1100 },
    ],
    cooldown: 50 * 60 * 1000,
    requirement: { totalEarned: 2000 },
    sector: 'service',
  },
  {
    id: 'bouncer',
    name: 'Bouncer',
    emoji: '💪',
    description: 'Keep the peace at local establishments. Steady work with room to grow.',
    tiers: [
      { name: 'Door Guard', salary: 400 },
      { name: 'Floor Security', salary: 600 },
      { name: 'Head Bouncer', salary: 900 },
      { name: 'Security Chief', salary: 1300 },
    ],
    cooldown: 90 * 60 * 1000,
    requirement: { totalEarned: 0 },
    sector: 'service',
  },
  {
    id: 'mechanic',
    name: 'Mechanic',
    emoji: '🔧',
    description: 'Fix and tune vehicles for the neighborhood. Reliable mid-game income.',
    tiers: [
      { name: 'Apprentice', salary: 500 },
      { name: 'Technician', salary: 800 },
      { name: 'Specialist', salary: 1100 },
      { name: 'Master Mechanic', salary: 1500 },
    ],
    cooldown: 2 * 60 * 60 * 1000,
    requirement: { totalEarned: 5000 },
    sector: 'trade',
  },
  {
    id: 'bartender',
    name: 'Bartender',
    emoji: '🍸',
    description: 'Mix drinks and network with the city crowd. Tips are good.',
    tiers: [
      { name: 'Barback', salary: 600 },
      { name: 'Bartender', salary: 900 },
      { name: 'Head Bartender', salary: 1300 },
      { name: 'Bar Manager', salary: 1800 },
    ],
    cooldown: 150 * 60 * 1000,
    requirement: { totalEarned: 15000 },
    sector: 'service',
  },
  {
    id: 'locksmith',
    name: 'Locksmith',
    emoji: '🔓',
    description: 'Open what should stay closed. Legitimate shop, questionable clientele.',
    tiers: [
      { name: 'Trainee', salary: 700 },
      { name: 'Locksmith', salary: 1000 },
      { name: 'Safe Cracker', salary: 1400 },
      { name: 'Master Locksmith', salary: 1900 },
    ],
    cooldown: 2 * 60 * 60 * 1000,
    requirement: { totalEarned: 25000 },
    sector: 'trade',
  },
  {
    id: 'dealer',
    name: 'Dealer',
    emoji: '🃏',
    description: 'Run the tables. High earnings, but the heat is always on.',
    tiers: [
      { name: 'Shill', salary: 800 },
      { name: 'Dealer', salary: 1200 },
      { name: 'Pit Boss', salary: 1700 },
      { name: 'Floor Manager', salary: 2300 },
    ],
    cooldown: 3 * 60 * 60 * 1000,
    requirement: { totalEarned: 30000 },
    sector: 'casino',
  },
  {
    id: 'enforcer',
    name: 'Enforcer',
    emoji: '👊',
    description: "Handle problems that words can't. Dangerous but lucrative.",
    tiers: [
      { name: 'Runner', salary: 1000 },
      { name: 'Enforcer', salary: 1500 },
      { name: 'Lieutenant', salary: 2000 },
      { name: 'Right Hand', salary: 2800 },
    ],
    cooldown: 210 * 60 * 1000,
    requirement: { totalEarned: 50000 },
    sector: 'underworld',
  },
  {
    id: 'smuggler',
    name: 'Smuggler',
    emoji: '🛩️',
    description: 'Move product across borders. High risk, high reward.',
    tiers: [
      { name: 'Mule', salary: 1100 },
      { name: 'Smuggler', salary: 1600 },
      { name: 'Route Boss', salary: 2200 },
      { name: 'Kingpin Runner', salary: 3000 },
    ],
    cooldown: 4 * 60 * 60 * 1000,
    requirement: { totalEarned: 65000 },
    sector: 'underworld',
  },
  {
    id: 'hacker',
    name: 'Hacker',
    emoji: '💻',
    description: 'Work the digital underground. Quiet money, high skill ceiling.',
    tiers: [
      { name: 'Script Kiddie', salary: 1200 },
      { name: 'Hacker', salary: 1800 },
      { name: 'Elite Hacker', salary: 2500 },
      { name: 'Ghost', salary: 3500 },
    ],
    cooldown: 4 * 60 * 60 * 1000,
    requirement: { totalEarned: 75000 },
    sector: 'tech',
  },
  {
    id: 'surveillance',
    name: 'Surveillance',
    emoji: '📡',
    description: 'Watch, listen, and gather leverage. The camera sees everything.',
    tiers: [
      { name: 'Observer', salary: 1300 },
      { name: 'Analyst', salary: 1900 },
      { name: 'Spook', salary: 2600 },
      { name: 'Director', salary: 3400 },
    ],
    cooldown: 4 * 60 * 60 * 1000,
    requirement: { totalEarned: 90000 },
    sector: 'tech',
  },
  {
    id: 'lawyer',
    name: 'Lawyer',
    emoji: '⚖️',
    description: 'Defend the indefensible. Slow start, massive long-term payoff.',
    tiers: [
      { name: 'Paralegal', salary: 1500 },
      { name: 'Attorney', salary: 2200 },
      { name: 'Senior Partner', salary: 3000 },
      { name: 'Power Attorney', salary: 4000 },
    ],
    cooldown: 5 * 60 * 60 * 1000,
    requirement: { totalEarned: 100000 },
    sector: 'corporate',
  },
  {
    id: 'accountant',
    name: 'Accountant',
    emoji: '📊',
    description: 'Follow the money. Cook the books. Nobody checks the math.',
    tiers: [
      { name: 'Clerk', salary: 1600 },
      { name: 'Accountant', salary: 2300 },
      { name: 'Auditor', salary: 3100 },
      { name: 'CFO', salary: 4200 },
    ],
    cooldown: 4 * 60 * 60 * 1000,
    requirement: { totalEarned: 150000 },
    sector: 'corporate',
  },
  {
    id: 'fixer',
    name: 'Fixer',
    emoji: '🕵️',
    description: 'Make problems disappear. Only the connected need apply.',
    tiers: [
      { name: 'Contact', salary: 1800 },
      { name: 'Fixer', salary: 2600 },
      { name: 'Broker', salary: 3500 },
      { name: 'Shadow Broker', salary: 4500 },
    ],
    cooldown: 5 * 60 * 60 * 1000,
    requirement: { totalEarned: 200000 },
    sector: 'underworld',
  },
  {
    id: 'consigliere',
    name: 'Consigliere',
    emoji: '🎩',
    description: 'The ear of the boss. The pinnacle of the career ladder.',
    tiers: [
      { name: 'Advisor', salary: 2500 },
      { name: 'Consigliere', salary: 3500 },
      { name: 'Underboss', salary: 4500 },
      { name: 'The Don', salary: 6000 },
    ],
    cooldown: 6 * 60 * 60 * 1000,
    requirement: { totalEarned: 500000 },
    sector: 'underworld',
  },
];

const TIER_NAMES = ['Entry', 'Skilled', 'Senior', 'Executive'];

const PROMOTION_WORKS = [10, 20, 35];

const SECTOR_LABELS = {
  street: 'Street',
  service: 'Service',
  trade: 'Trade',
  casino: 'Casino',
  underworld: 'Underworld',
  tech: 'Tech',
  corporate: 'Corporate',
};

function getJobById(id) {
  return JOBS.find((j) => j.id === id) || null;
}

function getJobByName(name) {
  const lower = name.toLowerCase();
  return JOBS.find((j) => j.id === lower || j.name.toLowerCase() === lower) || null;
}

function getWorksForPromotion(tier) {
  if (tier >= 3) return null;
  return PROMOTION_WORKS[tier];
}

function getSalary(job, tier) {
  return job.tiers[Math.min(tier, job.tiers.length - 1)].salary;
}

function getTierName(tier) {
  return TIER_NAMES[Math.min(tier, TIER_NAMES.length - 1)];
}

function getJobTierName(job, tier) {
  return job.tiers[Math.min(tier, job.tiers.length - 1)].name;
}

module.exports = {
  JOBS,
  TIER_NAMES,
  PROMOTION_WORKS,
  SECTOR_LABELS,
  getJobById,
  getJobByName,
  getWorksForPromotion,
  getSalary,
  getTierName,
  getJobTierName,
};

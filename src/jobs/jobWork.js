const embed = require('../utils/embed');
const User = require('../models/User');
const { getUser, fmt } = require('../utils/economy');
const { logAudit } = require('../utils/audit');
const { JOBS, getSalary, getJobTierName, getTierName, getWorksForPromotion } = require('../data/jobs');
const { JOB_WORK_WAGE_INCREMENT, JOB_WORK_COOLDOWN_INCREMENT } = require('../config');

const WORK_FLAVOR = {
  pickpocket: ['lifted a fat wallet', 'worked a busy market', 'stole a watch off a mark', 'picked a tourist clean'],
  street_hustler: [
    'made a quick deal on the corner',
    'ran a street scam',
    'picked up a package from a contact',
    'collected from a debtor',
  ],
  courier: [
    'delivered a mystery package',
    'ran a midnight delivery',
    'smuggled a care package across town',
    'dropped off a sealed envelope',
  ],
  bouncer: [
    'worked the door at a club',
    'escorted a rowdy patron out',
    'patrolled the parking lot',
    'stood watch all night',
  ],
  mechanic: [
    'tuned up an engine',
    'fixed a brake line',
    'rebuilt a transmission',
    'diagnosed a tricky electrical issue',
  ],
  bartender: [
    'mixed cocktails for a packed bar',
    'served the regulars',
    'ran a tab for a big spender',
    'invented a new drink special',
  ],
  locksmith: ['picked a stubborn lock', 'cracked an old safe', 'rekeyed a storefront', 'bypassed a deadbolt'],
  dealer: [
    'dealt a hot streak at the blackjack table',
    'ran the poker room',
    'managed the high-roller pit',
    'kept the games flowing',
  ],
  enforcer: ['delivered a message', 'escorted a shipment', 'resolved a dispute', 'made sure things ran smoothly'],
  smuggler: [
    'ran a load across the border',
    'stashed a shipment under a false floor',
    'bribed a checkpoint guard',
    'moved product through the docks',
  ],
  hacker: ['breached a firewall', 'ransomed some data', 'ran a phishing op', 'cracked a secure network'],
  surveillance: [
    'staked out a rival crew',
    'tapped a phone line',
    'reviewed security footage',
    'planted a listening device',
  ],
  lawyer: [
    'won a tough case',
    'settled out of court',
    'buried the prosecution in motions',
    'defended a high-profile client',
  ],
  accountant: [
    'cooked the books for a client',
    'hid a fortune in shell companies',
    'balanced a shady ledger',
    'laundered a payout through paper trails',
  ],
  fixer: [
    'made a problem disappear',
    'brokered a deal between rivals',
    'arranged a clean exit',
    'connected the right people',
  ],
  consigliere: [
    'counseled the boss on a merger',
    'settled an internal dispute',
    'orchestrated a power move',
    'kept the family organized',
  ],
};

const run = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);

  if (!user.currentJob) {
    return reply({
      embeds: [embed.warning('Unemployed', "You don't have a job. Use `/jobs` to browse careers.")],
      ephemeral: true,
    });
  }

  const job = JOBS.find((j) => j.id === user.currentJob);
  if (!job) {
    return reply({
      embeds: [embed.error('Your job data is invalid. Contact an admin.')],
      ephemeral: true,
    });
  }

  // Seniority within the current tier: wage rises and cooldown stretches incrementally
  // per work completed, rewarding loyalty but pacing higher earners.
  const worksInTier = user.jobWorks || 0;
  const effectiveCooldown = (job.cooldown || 60 * 60 * 1000) + worksInTier * JOB_WORK_COOLDOWN_INCREMENT;
  const effectiveSalary = getSalary(job, user.jobTier) + worksInTier * JOB_WORK_WAGE_INCREMENT;

  if (user.lastJobWork) {
    const elapsed = Date.now() - new Date(user.lastJobWork).getTime();
    if (elapsed < effectiveCooldown) {
      const remaining = effectiveCooldown - elapsed;
      const mins = Math.ceil(remaining / 60000);
      return reply({
        embeds: [embed.warning('Still Working', `You're still on the clock. Come back in **${mins}m**.`)],
        ephemeral: true,
      });
    }
  }

  const salary = effectiveSalary;
  const flavors = WORK_FLAVOR[job.id] || ['did some work'];
  const flavor = flavors[Math.floor(Math.random() * flavors.length)];

  const worksForPromo = getWorksForPromotion(user.jobTier);
  const nextWorks = user.jobWorks + 1;
  const gettingPromoted = worksForPromo && nextWorks >= worksForPromo;
  const nextTier = gettingPromoted ? user.jobTier + 1 : user.jobTier;

  const updateOps = {
    $set: { lastJobWork: new Date() },
    $inc: { wallet: salary, balance: salary, totalEarned: salary, jobWorks: 1 },
  };

  if (gettingPromoted) {
    updateOps.$set.jobTier = nextTier;
    updateOps.$set.jobWorks = 0;
    updateOps.$inc = { wallet: salary, balance: salary, totalEarned: salary };
  }

  const filter = {
    userId,
    guildId,
    currentJob: job.id,
    $or: [{ lastJobWork: null }, { lastJobWork: { $lte: new Date(Date.now() - effectiveCooldown) } }],
  };

  const updated = await User.findOneAndUpdate(filter, updateOps, { new: true });

  if (!updated) {
    return reply({
      embeds: [embed.error('Failed to process work. Your account may be frozen.')],
      ephemeral: true,
    });
  }

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'job_work',
    amount: salary,
    currency: 'wallet',
    metadata: { job: job.id, tier: user.jobTier, promoted: gettingPromoted },
  });

  let message = `You ${flavor} as a **${getJobTierName(job, user.jobTier)} ${job.name}** and earned ${fmt(salary)}.`;

  if (worksInTier > 0 && !gettingPromoted) {
    message += `\n(Seniority bonus +${fmt(worksInTier * JOB_WORK_WAGE_INCREMENT)})`;
  }

  if (gettingPromoted) {
    const newTierName = getJobTierName(job, nextTier);
    const newTierLabel = getTierName(nextTier);
    const newSalary = getSalary(job, nextTier);
    message += `\n\n🎉 **PROMOTED!** You are now a **${newTierName}** (${newTierLabel}).\nNew salary: ${fmt(newSalary)}`;
  } else if (worksForPromo) {
    const remaining = worksForPromo - nextWorks;
    message += `\n\nPromotion progress: ${nextWorks}/${worksForPromo} (${remaining} more to promote)`;
  }

  const nextCooldown = effectiveCooldown + JOB_WORK_COOLDOWN_INCREMENT;
  message += `\n\nNext shift cooldown: ${Math.round(nextCooldown / 60000)}m\nCash: ${fmt(updated.wallet)}`;

  return reply({
    embeds: [embed.success('Work Complete', message)],
  });
};

module.exports = { run };

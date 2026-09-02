const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const {
  JOBS,
  SECTOR_LABELS,
  TIER_NAMES,
  getSalary,
  getTierName,
  getJobTierName,
  getWorksForPromotion,
} = require('../../data/jobs');

function jobDetailEmbed(job, user) {
  const e = embed.economy(`${job.emoji} ${job.name}`, job.description);
  const sector = SECTOR_LABELS[job.sector] || job.sector;
  e.addFields({ name: 'Sector', value: sector, inline: true });

  const tierLines = job.tiers.map((tier, i) => {
    const tierLabel = TIER_NAMES[i];
    const worksNeeded = getWorksForPromotion(i);
    return `**${tier.name}** (${tierLabel})\nSalary: ${fmt(tier.salary)}${worksNeeded ? ` · ${worksNeeded} works to promote` : ' · **Max tier**'}`;
  });

  e.addFields({ name: 'Tiers', value: tierLines.join('\n\n') });

  if (user) {
    const meetsReq = user.totalEarned >= job.requirement.totalEarned;
    const employed = user.currentJob === job.id;
    const status = employed
      ? '**You work here**'
      : meetsReq
        ? '✅ Qualified'
        : `🔒 Need ${fmt(job.requirement.totalEarned)} earned`;
    e.addFields({ name: 'Your Status', value: status, inline: true });
  } else if (job.requirement.totalEarned > 0) {
    e.addFields({ name: 'Requirement', value: `${fmt(job.requirement.totalEarned)} total earned`, inline: true });
  }

  return e;
}

const run = async ({ userId, guildId, jobName, reply }) => {
  const user = await getUser(userId, guildId);

  if (!jobName && !user.currentJob) {
    return reply({
      embeds: [embed.warning('No Job', "You don't have a job. Use `/jobs` to browse careers.")],
      ephemeral: true,
    });
  }

  if (!jobName) {
    const job = JOBS.find((j) => j.id === user.currentJob);
    if (!job) {
      return reply({
        embeds: [embed.error('Your current job data is invalid. Contact an admin.')],
        ephemeral: true,
      });
    }

    const salary = getSalary(job, user.jobTier);
    const tierName = getJobTierName(job, user.jobTier);
    const tierLabel = getTierName(user.jobTier);
    const worksForPromo = getWorksForPromotion(user.jobTier);
    const nextSalary = user.jobTier < 3 ? getSalary(job, user.jobTier + 1) : null;

    const e = embed
      .economy(`${job.emoji} ${job.name} — Your Career`, null)
      .addFields(
        { name: 'Rank', value: `${tierName} (${tierLabel})`, inline: true },
        { name: 'Salary', value: fmt(salary), inline: true },
        { name: 'Sector', value: SECTOR_LABELS[job.sector] || job.sector, inline: true },
      );

    if (worksForPromo) {
      const remaining = worksForPromo - user.jobWorks;
      e.addFields({
        name: 'Promotion',
        value: `${user.jobWorks}/${worksForPromo} works · ${remaining > 0 ? `${remaining} more to promote` : 'Ready to promote!'}`,
        inline: true,
      });
    } else {
      e.addFields({ name: 'Promotion', value: 'Max rank reached', inline: true });
    }

    if (nextSalary) {
      e.addFields({ name: 'Next Tier Salary', value: fmt(nextSalary), inline: true });
    }

    return reply({ embeds: [e] });
  }

  const job = JOBS.find((j) => j.id === jobName.toLowerCase() || j.name.toLowerCase() === jobName.toLowerCase());
  if (!job) {
    return reply({
      embeds: [embed.error(`No job found matching "**${jobName}**". Use \`/jobs\` to see available careers.`)],
      ephemeral: true,
    });
  }

  return reply({ embeds: [jobDetailEmbed(job, user)] });
};

module.exports = {
  name: 'job',
  description: 'View your current job or details about a specific career.',
  usage: '[job name]',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('job')
    .setDescription('View your current job or a specific career')
    .addStringOption((o) => o.setName('job').setDescription('Job name to look up').setRequired(false)),

  async execute({ message, args }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      jobName: args.join(' ') || null,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      jobName: interaction.options.getString('job'),
      reply: (data) => interaction.reply(data),
    });
  },
};

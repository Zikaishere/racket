const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const User = require('../../models/User');
const { getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { JOBS, getJobTierName, getTierName, getSalary } = require('../../data/jobs');
const { JOB_CHANGE_COOLDOWN } = require('../../config');

const run = async ({ userId, guildId, jobName, reply }) => {
  if (!jobName) {
    return reply({
      embeds: [embed.error('Specify a job to apply for. Use `/jobs` to see available careers.')],
      ephemeral: true,
    });
  }

  const user = await getUser(userId, guildId);

  if (user.currentJob) {
    return reply({
      embeds: [embed.warning('Already Employed', 'You already have a job. Use `/job-quit` first.')],
      ephemeral: true,
    });
  }

  if (user.lastJobChange) {
    const elapsed = Date.now() - new Date(user.lastJobChange).getTime();
    if (elapsed < JOB_CHANGE_COOLDOWN) {
      const remaining = JOB_CHANGE_COOLDOWN - elapsed;
      const mins = Math.ceil(remaining / 60000);
      return reply({
        embeds: [embed.warning('Cooling Off', `Wait **${mins}m** before applying for a new job.`)],
        ephemeral: true,
      });
    }
  }

  const job = JOBS.find((j) => j.id === jobName.toLowerCase() || j.name.toLowerCase() === jobName.toLowerCase());
  if (!job) {
    return reply({
      embeds: [embed.error(`No job found matching "**${jobName}**". Use \`/jobs\` to see available careers.`)],
      ephemeral: true,
    });
  }

  if (user.totalEarned < job.requirement.totalEarned) {
    return reply({
      embeds: [
        embed.error(
          `You need **${fmt(job.requirement.totalEarned)}** total earned to apply for ${job.name}. You have **${fmt(user.totalEarned)}**.`,
        ),
      ],
      ephemeral: true,
    });
  }

  const salary = getSalary(job, 0);
  const tierName = getJobTierName(job, 0);
  const tierLabel = getTierName(0);

  const updated = await User.findOneAndUpdate(
    { userId, guildId, currentJob: null },
    {
      $set: {
        currentJob: job.id,
        jobTier: 0,
        jobWorks: 0,
        lastJobChange: new Date(),
      },
    },
    { new: true },
  );

  if (!updated) {
    return reply({
      embeds: [embed.error('Failed to apply. Your account may be frozen.')],
      ephemeral: true,
    });
  }

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'job_apply',
    amount: 0,
    currency: 'wallet',
    metadata: { job: job.id, tier: 0 },
  });

  return reply({
    embeds: [
      embed.success(
        'Job Application Accepted',
        `Welcome to **${job.name}**!\n\nRank: **${tierName}** (${tierLabel})\nSalary: ${fmt(salary)}/work\n\nUse \`/job-work\` to start earning.`,
      ),
    ],
  });
};

module.exports = {
  name: 'job-apply',
  aliases: ['apply'],
  description: 'Apply for a career.',
  usage: '<job name>',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('job-apply')
    .setDescription('Apply for a career')
    .addStringOption((o) => o.setName('job').setDescription('Job to apply for').setRequired(true)),

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

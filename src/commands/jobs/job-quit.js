const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');
const User = require('../../models/User');
const { getUser } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { JOBS } = require('../../data/jobs');

const run = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);

  if (!user.currentJob) {
    return reply({
      embeds: [embed.warning('Unemployed', "You don't have a job to quit.")],
      ephemeral: true,
    });
  }

  const job = JOBS.find((j) => j.id === user.currentJob);
  const jobLabel = job ? job.name : user.currentJob;

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('job_quit_confirm').setLabel('Quit Job').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('job_quit_cancel').setLabel('Keep Job').setStyle(ButtonStyle.Secondary),
  );

  return reply({
    embeds: [embed.warning('Quit Job', `Are you sure you want to quit **${jobLabel}**? You can reapply later.`)],
    components: [confirmRow],
  });
};

const confirmRun = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);

  if (!user.currentJob) {
    return reply({
      embeds: [embed.warning('Unemployed', "You don't have a job to quit.")],
      ephemeral: true,
    });
  }

  const job = JOBS.find((j) => j.id === user.currentJob);
  const jobLabel = job ? job.name : user.currentJob;

  const updated = await User.findOneAndUpdate(
    { userId, guildId, currentJob: { $ne: null } },
    {
      $set: {
        currentJob: null,
        jobTier: 0,
        jobWorks: 0,
        lastJobChange: new Date(),
      },
    },
    { new: true },
  );

  if (!updated) {
    return reply({
      embeds: [embed.error('Failed to process resignation.')],
      ephemeral: true,
    });
  }

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'job_quit',
    amount: 0,
    currency: 'wallet',
    metadata: { job: user.currentJob, tier: user.jobTier },
  });

  return reply({
    embeds: [
      embed.success(
        'Job Resigned',
        `You quit your job as a **${jobLabel}**.\n\nYou can apply for a new job anytime with \`/job-apply\`.`,
      ),
    ],
  });
};

module.exports = {
  name: 'job-quit',
  aliases: ['jquit', 'resign'],
  description: 'Quit your current career.',
  usage: '',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('job-quit').setDescription('Quit your current career'),

  async execute({ message }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      reply: (data) => interaction.reply(data),
    });
  },

  components: {
    job_quit_confirm: async ({ interaction }) => {
      return confirmRun({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        reply: (data) => interaction.reply(data),
      });
    },
    job_quit_cancel: async ({ interaction }) => {
      return interaction.reply({
        embeds: [embed.info('Kept Job', 'You decided to stay. Smart move.')],
        ephemeral: true,
      });
    },
  },
};

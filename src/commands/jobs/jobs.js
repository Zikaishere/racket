const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { JOBS, SECTOR_LABELS, getSalary } = require('../../data/jobs');

const run = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);

  const lines = JOBS.map((job) => {
    const entrySalary = getSalary(job, 0);
    const unlocked = user.totalEarned >= job.requirement.totalEarned;
    const employed = user.currentJob === job.id;
    const status = employed ? ' **[CURRENT]**' : unlocked ? '' : ' 🔒';
    const sector = SECTOR_LABELS[job.sector] || job.sector;

    return `${job.emoji} **${job.name}** — ${fmt(entrySalary)}/work · ${sector}${status}`;
  });

  const e = embed
    .economy('💼 Career Board', lines.join('\n'))
    .setFooter({ text: 'Use /job-apply <name> to apply · /job <name> for details' });

  return reply({ embeds: [e] });
};

module.exports = {
  name: 'jobs',
  aliases: ['careers', 'career'],
  description: 'Browse available careers.',
  usage: '',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('jobs').setDescription('Browse available careers'),

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
};

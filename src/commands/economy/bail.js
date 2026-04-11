const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { BAIL_BASE_COST, BAIL_COST_PER_MINUTE } = require('../../config');

function getBailCost(user) {
  const wantedUntil = user.wantedUntil ? new Date(user.wantedUntil).getTime() : 0;
  const remainingMs = Math.max(0, wantedUntil - Date.now());
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  return {
    remainingMs,
    remainingMinutes,
    cost: BAIL_BASE_COST + remainingMinutes * BAIL_COST_PER_MINUTE,
  };
}

const run = async ({ userId, guildId, reply }) => {
  const user = await getUser(userId, guildId);
  const { remainingMs, remainingMinutes, cost } = getBailCost(user);

  if (remainingMs <= 0) {
    return reply({
      embeds: [embed.info('Bail Desk', 'You are not wanted right now. There is nothing to bail out of.')],
    });
  }

  if (user.balance < cost) {
    return reply({
      embeds: [
        embed.error(
          `Bail costs ${fmt(cost)} right now, and you only have ${fmt(user.balance)}.\n\nWanted time remaining: ${remainingMinutes} minute(s).`,
        ),
      ],
      ephemeral: true,
    });
  }

  user.balance -= cost;
  user.wantedUntil = null;
  await user.save();

  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'wanted_bail_paid',
    amount: cost,
    currency: 'wallet',
    metadata: { remainingMinutes },
  });

  return reply({
    embeds: [
      embed.success(
        'Bail Paid',
        `You paid ${fmt(cost)} to clear your wanted status.\n\nNew balance: ${fmt(user.balance)}`,
      ),
    ],
  });
};

module.exports = {
  name: 'bail',
  aliases: ['clearwanted'],
  description: 'Pay a large bail to remove your wanted status.',
  usage: '',
  category: 'economy',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('bail').setDescription('Pay bail to remove your wanted status'),

  async execute({ message }) {
    return run({ userId: message.author.id, guildId: message.guild.id, reply: (data) => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      reply: (data) => interaction.reply(data),
    });
  },
  _test: {
    getBailCost,
  },
};

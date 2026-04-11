const embed = require('../../utils/embed');
const User = require('../../models/User');
const { logAudit } = require('../../utils/audit');

module.exports = {
  name: 'unban',
  aliases: [],
  description: 'Remove a global economy/game ban from a user.',
  usage: '<userId|@user>',
  category: 'dev',
  devOnly: true,

  async execute({ message, args }) {
    const rawTarget = args[0];
    if (!rawTarget) {
      return message.reply({ embeds: [embed.error('Usage: `r.unban <userId|@user>`')] });
    }

    const target = message.mentions.users.first();
    const targetId = target?.id || rawTarget.replace(/[<@!>]/g, '');

    if (!/^\d{17,20}$/.test(targetId)) {
      return message.reply({ embeds: [embed.error('Please provide a valid Discord user ID or mention.')] });
    }

    const result = await User.updateMany(
      { userId: targetId },
      {
        $set: {
          'moderation.globallyBanned': false,
          'moderation.globalBanReason': null,
          'moderation.globalBannedAt': null,
          'moderation.globalBannedBy': null,
        },
      },
    );

    await logAudit({
      actorId: message.author.id,
      targetId,
      action: 'dev_global_unban',
      metadata: { affectedRecords: result.modifiedCount },
    });

    return message.reply({
      embeds: [embed.success('Global Ban Removed', `<@${targetId}> can use economy and game commands again.`)],
    });
  },
};

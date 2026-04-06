const embed = require('../../utils/embed');
const User = require('../../models/User');
const { logAudit } = require('../../utils/audit');

module.exports = {
  name: 'ban',
  aliases: [],
  description: 'Globally ban a user from economy and game systems.',
  usage: '<userId|@user> [reason]',
  category: 'dev',
  devOnly: true,

  async execute({ message, args }) {
    const rawTarget = args[0];
    if (!rawTarget) {
      return message.reply({ embeds: [embed.error('Usage: `r.ban <userId|@user> [reason]`')] });
    }

    const target = message.mentions.users.first();
    const targetId = target?.id || rawTarget.replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ').trim() || null;

    if (!/^\d{17,20}$/.test(targetId)) {
      return message.reply({ embeds: [embed.error('Please provide a valid Discord user ID or mention.')] });
    }

    const guildIds = [...message.client.guilds.cache.keys()];
    for (const guildId of guildIds) {
      await User.findOneAndUpdate(
        { userId: targetId, guildId },
        {
          $set: {
            'moderation.globallyBanned': true,
            'moderation.globalBanReason': reason,
            'moderation.globalBannedAt': new Date(),
            'moderation.globalBannedBy': message.author.id,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    await logAudit({
      actorId: message.author.id,
      targetId,
      action: 'dev_global_ban',
      metadata: { reason, guildCount: guildIds.length }
    });

    return message.reply({
      embeds: [embed.success('Global Ban Applied', `<@${targetId}> is now blocked from economy and game commands across **${guildIds.length}** guild(s).${reason ? `\nReason: ${reason}` : ''}`)]
    });
  }
};

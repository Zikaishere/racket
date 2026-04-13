const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { TAX_RATE, TAX_THRESHOLD, EVADE_FINE_RATE } = require('../../config');

const run = async ({ userId, guildId, action, rawAmount, evade, reply }) => {
  const user = await getUser(userId, guildId);

  if (user.casinoBanEnds && new Date(user.casinoBanEnds).getTime() > Date.now()) {
    const remaining = Math.ceil((new Date(user.casinoBanEnds).getTime() - Date.now()) / 60000);
    return reply({
      embeds: [embed.error(`You are barred from the floor for ${remaining} more minutes due to caught tax evasion.`)],
      ephemeral: true,
    });
  }

  if (action === 'buy') {
    const normalized = String(rawAmount).toLowerCase();
    const amount = normalized === 'all' || normalized === 'max' ? user.wallet : parseInt(rawAmount, 10);

    if (isNaN(amount) || amount <= 0)
      return reply({ embeds: [embed.error('Please specify a valid amount.')], ephemeral: true });
    if (user.wallet < amount)
      return reply({
        embeds: [embed.error(`You don't have enough raqs.\n\nWallet: ${fmt(user.wallet)}`)],
        ephemeral: true,
      });

    user.wallet -= amount;
    user.chips += amount;
    await user.save();
    await logAudit({ guildId, actorId: userId, targetId: userId, action: 'cashier_buy', amount, currency: 'wallet' });

    return reply({
      embeds: [
        embed.success(
          'Chips Purchased',
          `You bought **${amount.toLocaleString()}** chips.\n\nWallet: ${fmt(user.wallet)}\nChips: **${user.chips.toLocaleString()}**`,
        ),
      ],
    });
  }

  if (action === 'cashout') {
    const normalized = String(rawAmount).toLowerCase();
    const amount = normalized === 'all' || normalized === 'max' ? user.chips : parseInt(rawAmount, 10);

    if (isNaN(amount) || amount <= 0)
      return reply({ embeds: [embed.error('Please specify a valid amount.')], ephemeral: true });
    if (user.chips < amount)
      return reply({
        embeds: [embed.error(`You don't have enough chips.\n\nChips: **${user.chips.toLocaleString()}**`)],
        ephemeral: true,
      });

    let finalAmount = amount;
    let taxAmount = 0;
    let taxMessage = '';
    let auditAction = 'cashier_cashout';

    if (amount >= TAX_THRESHOLD) {
      if (evade) {
        const roll = Math.random();
        if (roll < 0.3) {
          taxMessage = '\n\nTax evasion successful. You avoided the Syndicate tax completely.';
          user.taxEvasionHistory.success += 1;
          auditAction = 'cashier_cashout_evade_success';
        } else if (roll < 0.7) {
          taxAmount = Math.floor(amount * 0.02);
          taxMessage = `\n\nPartial evasion. You paid only a 2% cut (${fmt(taxAmount)}).`;
          auditAction = 'cashier_cashout_evade_partial';
        } else if (roll < 0.9) {
          taxAmount = Math.floor(amount * 0.1);
          taxMessage = `\n\nEvasion failed. The Syndicate charged a 10% penalty (${fmt(taxAmount)}).`;
          auditAction = 'cashier_cashout_evade_failed';
        } else {
          const fineAmount = Math.floor(amount * EVADE_FINE_RATE);
          user.chips -= amount;
          user.wallet += amount - fineAmount;
          user.taxEvasionHistory.caught += 1;
          user.casinoBanEnds = new Date(Date.now() + 60 * 60 * 1000);
          await user.save();
          await logAudit({
            guildId,
            actorId: userId,
            targetId: userId,
            action: 'cashier_cashout_evade_busted',
            amount: fineAmount,
            currency: 'wallet',
          });
          return reply({
            embeds: [
              embed.error(
                `You were caught attempting to evade taxes on your cashout. They seized ${fmt(fineAmount)} and barred you from the casino for 1 hour.`,
              ),
            ],
          });
        }
      } else {
        taxAmount = Math.floor(amount * TAX_RATE);
        taxMessage = `\n\nSyndicate tax of 5% (${fmt(taxAmount)}) was deducted.`;
      }
    }

    finalAmount = amount - taxAmount;
    user.chips -= amount;
    user.wallet += finalAmount;
    await user.save();
    await logAudit({
      guildId,
      actorId: userId,
      targetId: userId,
      action: auditAction,
      amount: finalAmount,
      currency: 'wallet',
      metadata: { originalAmount: amount, taxAmount, evade },
    });

    return reply({
      embeds: [
        embed.success(
          'Chips Cashed Out',
          `You cashed out **${amount.toLocaleString()}** chips for **${fmt(finalAmount)}**.${taxMessage}\n\nWallet: ${fmt(user.wallet)}\nChips: **${user.chips.toLocaleString()}**`,
        ),
      ],
    });
  }
};

module.exports = {
  name: 'cashier',
  aliases: ['exchange'],
  description: 'Buy or cash out casino chips with your raqs.',
  usage: '<buy|cashout> <amount|all>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('cashier')
    .setDescription('Buy or cash out casino chips with your raqs')
    .addSubcommand((s) =>
      s
        .setName('buy')
        .setDescription('Buy chips with raqs')
        .addStringOption((o) => o.setName('amount').setDescription('Amount or "all"').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('cashout')
        .setDescription('Cash out chips for raqs')
        .addStringOption((o) => o.setName('amount').setDescription('Amount or "all"').setRequired(true))
        .addBooleanOption((o) =>
          o.setName('evade').setDescription('Attempt to evade the Syndicate tax').setRequired(false),
        ),
    ),

  async execute({ message, args }) {
    const action = args[0]?.toLowerCase();
    const rawAmount = args[1];
    const evade = args[2]?.toLowerCase() === 'evade' || args[2]?.toLowerCase() === '--evade';

    if (!['buy', 'cashout'].includes(action) || !rawAmount) {
      return message.reply({ embeds: [embed.error('Usage: `.cashier <buy|cashout> <amount|all> [--evade]`')] });
    }

    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      action,
      rawAmount,
      evade,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      action: interaction.options.getSubcommand(),
      rawAmount: interaction.options.getString('amount'),
      evade: interaction.options.getBoolean('evade') || false,
      reply: (data) => interaction.reply(data),
    });
  },
};

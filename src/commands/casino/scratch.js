const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');

const TIERS = [
  { name: 'Bust', chance: 0.52, multiplier: 0, symbol: '💀' },
  { name: 'Small Win', chance: 0.26, multiplier: 1.5, symbol: '💵' },
  { name: 'Big Win', chance: 0.16, multiplier: 3, symbol: '💎' },
  { name: 'Jackpot', chance: 0.06, multiplier: 8, symbol: '🎰' },
];

function rollTier() {
  let roll = Math.random();
  for (const tier of TIERS) {
    roll -= tier.chance;
    if (roll <= 0) return tier;
  }
  return TIERS[0];
}

const run = async ({ userId, guildId, bet, reply }) => {
  if (isNaN(bet) || bet < CASINO_MIN_BET || bet > CASINO_MAX_BET) {
    return reply({ embeds: [embed.error(`Bet must be between ${fmt(CASINO_MIN_BET)} and ${fmt(CASINO_MAX_BET)}.`)], ephemeral: true });
  }

  const user = await getUser(userId, guildId);
  if (user.chips < bet) {
    return reply({ embeds: [embed.error(`You don't have enough chips. Chips: **${user.chips.toLocaleString()}**`)], ephemeral: true });
  }

  user.chips -= bet;
  const results = [rollTier(), rollTier(), rollTier()];
  const best = results.sort((a, b) => b.multiplier - a.multiplier)[0];
  const payout = Math.floor(bet * best.multiplier);
  if (payout > 0) user.chips += payout;
  await user.save();
  await recordGame(userId, guildId, payout > bet, bet);
  await logAudit({ guildId, actorId: userId, targetId: userId, action: 'scratch_play', amount: payout - bet, currency: 'chips', metadata: { bet, tier: best.name } });

  const symbols = results.map(result => result.symbol).join(' | ');
  const description = payout > 0
    ? `You scratched **${best.name}** and got back **${payout.toLocaleString()}** chips.`
    : `Three bad reveals. The card was a dud and you lost **${bet.toLocaleString()}** chips.`;

  return reply({ embeds: [embed.raw(payout > 0 ? 0x2DC653 : 0xFF6B6B).setTitle('Scratch Card').setDescription(`[ ${symbols} ]\n\n${description}\n\nNew chips: **${user.chips.toLocaleString()}**`)] });
};

module.exports = {
  name: 'scratch',
  aliases: ['scratchcard'],
  description: 'Buy and reveal a scratch card for a quick casino hit.',
  usage: '<bet>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('scratch')
    .setDescription('Play a scratch card')
    .addIntegerOption(o => o.setName('bet').setDescription('Amount to risk').setRequired(true).setMinValue(CASINO_MIN_BET).setMaxValue(CASINO_MAX_BET)),

  async execute({ message, args }) {
    return run({ userId: message.author.id, guildId: message.guild.id, bet: parseInt(args[0], 10), reply: data => message.reply(data) });
  },

  async executeSlash({ interaction }) {
    return run({ userId: interaction.user.id, guildId: interaction.guild.id, bet: interaction.options.getInteger('bet'), reply: data => interaction.reply(data) });
  },
};

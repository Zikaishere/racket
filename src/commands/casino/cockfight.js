const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt, recordGame } = require('../../utils/economy');
const { logAudit } = require('../../utils/audit');
const { getChickenPower } = require('../../utils/itemStore');
const { CASINO_MIN_BET, CASINO_MAX_BET } = require('../../config');

function getChickenInventory(user) {
  return [...(user.inventory || [])]
    .filter((item) => item.quantity > 0 && item.kind === 'chicken')
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findChicken(user, query) {
  const chickens = getChickenInventory(user);
  const asIndex = parseInt(query, 10);
  if (!isNaN(asIndex) && asIndex >= 1 && asIndex <= chickens.length) {
    return chickens[asIndex - 1];
  }
  return chickens.find((chicken) => chicken.name.toLowerCase() === String(query).toLowerCase());
}

function generateHouseChicken() {
  const stats = {
    strength: 4 + Math.floor(Math.random() * 8),
    speed: 4 + Math.floor(Math.random() * 8),
    grit: 4 + Math.floor(Math.random() * 8),
  };

  return {
    name: 'Pit House Rooster',
    stats,
    rarity: 'house',
  };
}

const run = async ({ userId, guildId, query, bet, reply }) => {
  if (!query) {
    return reply({ embeds: [embed.error('Choose a chicken by inventory slot or exact name.')] });
  }

  if (isNaN(bet) || bet < CASINO_MIN_BET || bet > CASINO_MAX_BET) {
    return reply({
      embeds: [embed.error(`Bet must be between ${fmt(CASINO_MIN_BET)} and ${fmt(CASINO_MAX_BET)}.`)],
      ephemeral: true,
    });
  }

  const user = await getUser(userId, guildId);
  if (user.chips < bet) {
    return reply({
      embeds: [embed.error(`You don't have enough chips. Chips: **${user.chips.toLocaleString()}**`)],
      ephemeral: true,
    });
  }

  const chicken = findChicken(user, query);
  if (!chicken) {
    return reply({
      embeds: [embed.error('That chicken was not found in your inventory. Use `inventory` to get the slot number.')],
    });
  }

  const opponent = generateHouseChicken();
  const playerPower = getChickenPower(chicken) + Math.random() * 4;
  const housePower = getChickenPower(opponent) + Math.random() * 4;
  const winChance = Math.min(0.85, Math.max(0.2, playerPower / (playerPower + housePower)));
  const won = Math.random() < winChance;

  user.chips -= bet;
  let payout = 0;
  if (won) {
    const oddsMultiplier = Math.min(3.75, Math.max(1.35, 1.1 + (1 - winChance) * 3));
    payout = Math.floor(bet * oddsMultiplier);
    user.chips += payout;
  } else {
    user.inventory = user.inventory.filter((item) => item.itemId !== chicken.itemId);
  }

  await user.save();
  await recordGame(userId, guildId, won, bet);
  await logAudit({
    guildId,
    actorId: userId,
    targetId: userId,
    action: 'cockfight_bet',
    amount: won ? payout - bet : -bet,
    currency: 'chips',
    metadata: {
      chicken: chicken.name,
      chickenStats: chicken.stats,
      opponentStats: opponent.stats,
      won,
    },
  });

  const description = won
    ? `**${chicken.name}** won the fight and brought back **${payout.toLocaleString()}** chips.`
    : `**${chicken.name}** lost the fight and died in the pit. You lost the bet and the bird.`;

  return reply({
    embeds: [
      embed
        .raw(won ? 0x2dc653 : 0xff6b6b)
        .setTitle('Cockfight')
        .setDescription(
          `${description}\n\n**Your Bird**: STR ${chicken.stats?.strength || 0} | SPD ${chicken.stats?.speed || 0} | GRT ${chicken.stats?.grit || 0}\n**House Bird**: STR ${opponent.stats.strength} | SPD ${opponent.stats.speed} | GRT ${opponent.stats.grit}\n**Win Chance**: ${Math.round(winChance * 100)}%\n\nNew chips: **${user.chips.toLocaleString()}**`,
        ),
    ],
  });
};

module.exports = {
  name: 'cockfight',
  aliases: ['pitfight', 'rooster'],
  description: 'Bet chips on one of your chickens in the pit. Losing kills the bird permanently.',
  usage: '<slot|name> <bet>',
  category: 'casino',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('cockfight')
    .setDescription('Bet chips on one of your chickens in the pit')
    .addStringOption((o) =>
      o.setName('chicken').setDescription('Inventory slot number or chicken name').setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('bet')
        .setDescription('Amount to risk')
        .setRequired(true)
        .setMinValue(CASINO_MIN_BET)
        .setMaxValue(CASINO_MAX_BET),
    ),

  async execute({ message, args }) {
    const lastArg = args[args.length - 1];
    const bet = parseInt(lastArg, 10);
    const query = isNaN(bet) ? args.join(' ') : args.slice(0, -1).join(' ');
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      query,
      bet,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      query: interaction.options.getString('chicken'),
      bet: interaction.options.getInteger('bet'),
      reply: (data) => interaction.reply(data),
    });
  },
};

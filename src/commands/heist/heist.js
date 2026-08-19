const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const { getUser, fmt } = require('../../utils/economy');
const Crew = require('../../models/Crew');
const { reserveFunds } = require('../../utils/gameFunds');
const { getGuildCooldownMs } = require('../../utils/guildCooldowns');
const { HEIST_MIN_BET, HEIST_MAX_BET, HEIST_JOIN_WINDOW } = require('../../config');
const { getTargetForBet, STRATEGIES, ENTRY_POINTS, pickRole, shuffle } = require('../../heist/gameData');
const { resolveHeist } = require('../../heist/resolver');
const { buildPlanningEmbed, buildControls, buildSuccessEmbed, buildFailureEmbed, buildCancelledEmbed } = require('../../heist/ui');

const activeHeists = new Map();

function getRemainingMs(targetDate) {
  if (!targetDate) return 0;
  return Math.max(0, new Date(targetDate).getTime() - Date.now());
}

function scheduleLaunch(heist, client) {
  if (heist.timeout) clearTimeout(heist.timeout);
  heist.timeout = setTimeout(
    () => { resolveHeist(heist.guildId, heist, activeHeists).then((result) => sendResolution(result, heist)).catch(console.error); },
    Math.max(0, heist.launchAt - Date.now()),
  );
}

async function editHeistMessage(heist, payload) {
  if (!heist.message) return;
  await heist.message.edit(payload).catch(() => {});
}

async function sendResolution(result, heist) {
  if (result.type === 'cancelled') {
    return editHeistMessage(heist, { embeds: [buildCancelledEmbed(heist)], components: buildControls(heist, true) });
  }
  if (result.type === 'success') {
    return editHeistMessage(heist, { embeds: [buildSuccessEmbed(result)], components: buildControls(heist, true) });
  }
  if (result.type === 'failure') {
    return editHeistMessage(heist, { embeds: [buildFailureEmbed(result)], components: buildControls(heist, true) });
  }
}

const run = async ({ userId, guildId, username, bet, reply, client, baseCooldownMs }) => {
  if (activeHeists.has(guildId)) {
    return reply({ embeds: [embed.warning('Heist In Progress', 'There is already a heist being planned. Wait for it to finish.')], ephemeral: true });
  }

  if (isNaN(bet) || bet < HEIST_MIN_BET || bet > HEIST_MAX_BET) {
    return reply({ embeds: [embed.error(`Bet must be between ${fmt(HEIST_MIN_BET)} and ${fmt(HEIST_MAX_BET)}.`)], ephemeral: true });
  }

  const user = await getUser(userId, guildId);
  const cooldownRemaining = getRemainingMs(user.heistCooldownUntil);
  if (cooldownRemaining > 0) {
    return reply({ embeds: [embed.error(`Cooldown active. Try again in ${Math.ceil(cooldownRemaining / 60000)} minutes.`)], ephemeral: true });
  }
  if (user.wallet < bet) {
    return reply({ embeds: [embed.error(`Not enough raqs. Wallet: ${fmt(user.wallet)}`)], ephemeral: true });
  }

  const target = getTargetForBet(bet);
  const gameKey = `heist:${guildId}:${Date.now()}`;
  const reserved = await reserveFunds({ userId, guildId, game: 'heist', gameKey, currency: 'wallet', amount: bet, metadata: { username, target: target.name } });
  if (!reserved) {
    return reply({ embeds: [embed.error(`Not enough raqs. Wallet: ${fmt(user.wallet)}`)], ephemeral: true });
  }

  const permanentCrew = await Crew.findOne({ guildId, members: userId });
  const heist = {
    leaderId: userId,
    guildId,
    target,
    bet,
    crew: new Map([
      [userId, { bet, username, role: 'Mastermind', crewId: permanentCrew?._id?.toString() || null, crewName: permanentCrew?.name || null }],
    ]),
    crewId: permanentCrew?._id?.toString() || null,
    crewName: permanentCrew?.name || null,
    launchAt: Date.now() + HEIST_JOIN_WINDOW,
    strategy: 'balanced',
    entryOptions: shuffle(ENTRY_POINTS),
    selectedEntryIndex: 0,
    scoped: false,
    baseCooldownMs,
    gameKey,
    timeout: null,
    message: null,
  };

  activeHeists.set(guildId, heist);
  const message = await reply({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
  heist.message = message;
  scheduleLaunch(heist, client);
};

module.exports = {
  name: 'heist',
  aliases: ['raid'],
  description: 'Plan a heist and invite others to join your crew.',
  usage: '<bet>',
  category: 'heist',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('heist')
    .setDescription('Plan a heist and invite others to join your crew')
    .addIntegerOption((o) => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(HEIST_MIN_BET).setMaxValue(HEIST_MAX_BET)),

  async execute({ message, args, client, guildData }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      bet: parseInt(args[0], 10),
      reply: (data) => message.reply(data),
      client,
      baseCooldownMs: getGuildCooldownMs(guildData, 'heist'),
    });
  },

  async executeSlash({ interaction, client, guildData }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      bet: interaction.options.getInteger('bet'),
      reply: async (data) => {
        const response = await interaction.reply({ ...data, withResponse: true });
        return response.resource.message;
      },
      client,
      baseCooldownMs: getGuildCooldownMs(guildData, 'heist'),
    });
  },

  components: {
    heist: async ({ interaction, client }) => {
      const heist = activeHeists.get(interaction.guild.id);
      if (!heist) return interaction.reply({ embeds: [embed.error('This heist is no longer active.')], ephemeral: true });

      const id = interaction.customId;
      const userId = interaction.user.id;

      if (id === 'heist_join') {
        if (heist.crew.has(userId)) return interaction.reply({ embeds: [embed.error('You are already in this heist.')], ephemeral: true });
        if (heist.crew.size >= heist.target.maxCrew) return interaction.reply({ embeds: [embed.error(`This target supports max ${heist.target.maxCrew} crew.`)], ephemeral: true });

        const user = await getUser(userId, interaction.guild.id);
        const cooldownRemaining = getRemainingMs(user.heistCooldownUntil);
        if (cooldownRemaining > 0) return interaction.reply({ embeds: [embed.error(`Cooldown active. Try again in ${Math.ceil(cooldownRemaining / 60000)} minutes.`)], ephemeral: true });
        if (user.wallet < heist.bet) return interaction.reply({ embeds: [embed.error(`Need ${fmt(heist.bet)} to join. Wallet: ${fmt(user.wallet)}`)], ephemeral: true });

        const reserved = await reserveFunds({ userId, guildId: interaction.guild.id, game: 'heist', gameKey: heist.gameKey, currency: 'wallet', amount: heist.bet, metadata: { username: interaction.user.username, target: heist.target.name } });
        if (!reserved) return interaction.reply({ embeds: [embed.error(`Need ${fmt(heist.bet)} to join. Wallet: ${fmt(user.wallet)}`)], ephemeral: true });

        const permanentCrew = await Crew.findOne({ guildId: interaction.guild.id, members: userId });
        heist.crew.set(userId, {
          bet: heist.bet,
          username: interaction.user.username,
          role: pickRole(heist.crew),
          crewId: permanentCrew?._id?.toString() || null,
          crewName: permanentCrew?.name || null,
        });
        return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
      }

      if (userId !== heist.leaderId) return interaction.reply({ embeds: [embed.error('Only the leader can change the plan.')], ephemeral: true });

      if (id === 'heist_strategy') {
        const keys = Object.keys(STRATEGIES);
        const current = keys.indexOf(heist.strategy);
        heist.strategy = keys[(current + 1) % keys.length];
        return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
      }

      if (id === 'heist_entry') {
        heist.selectedEntryIndex = (heist.selectedEntryIndex + 1) % heist.entryOptions.length;
        return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
      }

      if (id === 'heist_scope') {
        if (!heist.scoped) {
          heist.scoped = true;
          heist.launchAt += 15000;
          scheduleLaunch(heist, client);
        }
        return interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, false) });
      }

      if (id === 'heist_launch') {
        await interaction.update({ embeds: [buildPlanningEmbed(heist)], components: buildControls(heist, true) });
        const result = await resolveHeist(interaction.guild.id, heist, activeHeists);
        return sendResolution(result, heist);
      }
    },
  },
};

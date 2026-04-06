const assert = require('node:assert/strict');
const { Collection, ChannelType } = require('discord.js');
const { BAIL_BASE_COST, BAIL_COST_PER_MINUTE } = require('../src/config');
const bailCommand = require('../src/commands/economy/bail');
const { buildSetupEmbed } = require('../src/utils/setupMessage');
const guildCreateEvent = require('../src/events/guildCreate');

async function runSetupAndBalanceTests() {
  const { getBailCost } = bailCommand._test;
  const { canSendInChannel, findWelcomeChannel } = guildCreateEvent._test;

  const noWanted = getBailCost({ wantedUntil: null });
  assert.equal(noWanted.remainingMs, 0, 'expected no wanted time when user is clear');
  assert.equal(noWanted.remainingMinutes, 0, 'expected no wanted minutes when user is clear');
  assert.equal(noWanted.cost, BAIL_BASE_COST, 'expected base bail cost when there is no remaining wanted time');

  const wantedUntil = new Date(Date.now() + (60 * 60 * 1000));
  const oneHourWanted = getBailCost({ wantedUntil });
  assert.ok(oneHourWanted.remainingMinutes >= 59 && oneHourWanted.remainingMinutes <= 60, 'expected about one hour of wanted time');
  assert.equal(oneHourWanted.cost, BAIL_BASE_COST + (oneHourWanted.remainingMinutes * BAIL_COST_PER_MINUTE));

  const setupEmbed = buildSetupEmbed('.');
  const setupJson = setupEmbed.toJSON();
  const setupFieldText = setupJson.fields.map(field => field.value).join('\n');
  assert.match(setupFieldText, /setuphere/, 'expected setup guide to mention setuphere');
  assert.match(setupFieldText, /configcommands/, 'expected setup guide to mention configcommands');

  const botMember = { id: 'bot-member' };
  const makeChannel = (name, rawPosition, allowed = true) => ({
    name,
    type: ChannelType.GuildText,
    rawPosition,
    permissionsFor() {
      return { has: () => allowed };
    },
  });

  assert.equal(canSendInChannel(makeChannel('general', 1, true), botMember), true, 'expected sendable text channel to be accepted');
  assert.equal(canSendInChannel(makeChannel('general', 1, false), botMember), false, 'expected blocked text channel to be rejected');

  const general = makeChannel('general', 5, true);
  const commands = makeChannel('commands', 7, true);
  const offLimits = makeChannel('private', 1, false);
  const fetchedChannels = new Collection([
    ['offLimits', offLimits],
    ['general', general],
    ['commands', commands],
  ]);

  const guild = {
    systemChannel: null,
    members: {
      me: null,
      fetchMe: async () => botMember,
    },
    channels: {
      cache: fetchedChannels,
      fetch: async () => fetchedChannels,
    },
  };

  const welcomeChannel = await findWelcomeChannel(guild);
  assert.equal(welcomeChannel, commands, 'expected a preferred setup channel to be selected before a generic one');
}

module.exports = { runSetupAndBalanceTests };

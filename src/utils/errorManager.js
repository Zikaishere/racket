const crypto = require('crypto');
const embed = require('./embed');
const ErrorLog = require('../models/ErrorLog');
const { DEV_LOG_CHANNEL_ID } = require('../config');

function createErrorId() {
  return `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function buildUserErrorEmbed(errorId) {
  return embed.error(
    `Something went wrong while running that action.\nError ID: \`${errorId}\`\n\nYou can report this issue using the \`/bug-report\` command.`,
  );
}

function serializeError(error) {
  if (!error) {
    return { message: 'Unknown error', stack: '' };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error',
      stack: error.stack || '',
    };
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
    stack: '',
  };
}

async function notifyDevChannel(client, errorId, payload) {
  if (!client || !DEV_LOG_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(DEV_LOG_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const errorEmbed = embed
      .raw(0xff6b6b)
      .setTitle(`Error Logged: ${errorId}`)
      .setDescription(
        `**Source:** ${payload.source}${payload.commandName ? `\n**Command:** ${payload.commandName}` : ''}`,
      )
      .addFields(
        { name: 'User ID', value: payload.userId || 'n/a', inline: true },
        { name: 'Guild ID', value: payload.guildId || 'n/a', inline: true },
        { name: 'Channel ID', value: payload.channelId || 'n/a', inline: true },
        { name: 'Message', value: (payload.message || 'Unknown error').slice(0, 1024), inline: false },
      );

    await channel.send({ embeds: [errorEmbed] });
  } catch (notifyError) {
    console.error(`Failed to send error log ${errorId} to dev log channel:`, notifyError);
  }
}

async function logError(error, context = {}, client = null) {
  const errorId = createErrorId();
  const serialized = serializeError(error);

  const payload = {
    errorId,
    source: context.source || 'unknown',
    commandName: context.commandName || null,
    userId: context.userId || null,
    guildId: context.guildId || null,
    channelId: context.channelId || null,
    interactionType: context.interactionType || null,
    message: serialized.message,
    stack: serialized.stack,
    metadata: context.metadata || {},
  };

  try {
    await ErrorLog.create(payload);
  } catch (persistError) {
    console.error(`Failed to persist error log ${errorId}:`, persistError);
  }

  console.error(`[${errorId}]`, error);
  await notifyDevChannel(client, errorId, payload);
  return errorId;
}

module.exports = {
  buildUserErrorEmbed,
  createErrorId,
  logError,
};

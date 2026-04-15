const { logError: _logError } = require('./errorManager.js');

const silentErrors = new Map();

function logSilentError(error, context = {}) {
  const errorId = `SILENT-${Date.now().toString(36).toUpperCase()}`;

  const errorObj =
    error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { message: String(error) };

  silentErrors.set(errorId, {
    ...errorObj,
    context,
    timestamp: new Date().toISOString(),
  });

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[SilentError:${errorId}]`, errorObj.message);
    console.warn('Context:', context);
  }

  return errorId;
}

function getSilentError(errorId) {
  return silentErrors.get(errorId) || null;
}

function clearSilentError(errorId) {
  silentErrors.delete(errorId);
}

function formatSilentError(error, context = {}) {
  const errorId = logSilentError(error, context);
  return {
    embeds: [
      {
        title: 'An error occurred',
        description: `Error ID: \`${errorId}\`\n\nThis error has been logged and will be reviewed.`,
        color: 0xff6b6b,
      },
    ],
    ephemeral: true,
  };
}

module.exports = {
  logSilentError,
  getSilentError,
  clearSilentError,
  formatSilentError,
};

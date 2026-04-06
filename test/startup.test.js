const assert = require('node:assert/strict');
const { validateRequiredEnv } = require('../src/utils/startup');

function runStartupTests() {
  const errors = validateRequiredEnv({
    BOT_TOKEN: 'abc123',
    MONGO_URI: 'mongodb://localhost:27017/test',
  });

  assert.deepEqual(errors, []);

  const invalidErrors = validateRequiredEnv({
    BOT_TOKEN: 'replace-with-your-discord-bot-token',
    MONGO_URI: '',
  });

  assert.equal(invalidErrors.length, 2);
  assert.match(invalidErrors[0], /BOT_TOKEN/);
  assert.match(invalidErrors[1], /MONGO_URI/);
}

module.exports = { runStartupTests };

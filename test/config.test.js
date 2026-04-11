const assert = require('node:assert/strict');
const config = require('../src/config');

function runConfigTests() {
  assert.equal(config.DEV_PREFIX, 'rack ');
  assert.ok(Array.isArray(config.DEV_IDS));
  assert.ok(config.DEV_IDS.includes('880070472434339880'));
  assert.equal(config.DEFAULT_PREFIX.length > 0, true);
}

module.exports = { runConfigTests };

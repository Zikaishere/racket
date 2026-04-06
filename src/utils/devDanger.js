const crypto = require('crypto');

const pendingDbWipes = new Map();
const CONFIRMATION_WINDOW_MS = 2 * 60 * 1000;

function createDbWipeRequest(userId) {
  const token = crypto.randomBytes(4).toString('hex');
  pendingDbWipes.set(userId, {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + CONFIRMATION_WINDOW_MS,
  });
  return pendingDbWipes.get(userId);
}

function getDbWipeRequest(userId) {
  const request = pendingDbWipes.get(userId);
  if (!request) return null;
  if (request.expiresAt <= Date.now()) {
    pendingDbWipes.delete(userId);
    return null;
  }
  return request;
}

function clearDbWipeRequest(userId) {
  pendingDbWipes.delete(userId);
}

module.exports = {
  CONFIRMATION_WINDOW_MS,
  createDbWipeRequest,
  getDbWipeRequest,
  clearDbWipeRequest,
};

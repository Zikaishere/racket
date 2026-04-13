const _ms = require('ms');

// In-memory cooldown store for commands (not economy cooldowns — those are in DB)
const cooldowns = new Map();

module.exports = {
  // Check if user is on cooldown. Returns remaining ms or 0.
  check: (userId, commandName, duration) => {
    const key = `${userId}:${commandName}`;
    const now = Date.now();
    if (cooldowns.has(key)) {
      const expires = cooldowns.get(key);
      if (now < expires) return expires - now;
    }
    cooldowns.set(key, now + duration);
    return 0;
  },

  // Format remaining cooldown nicely
  format: (remaining) => {
    if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s`;
    if (remaining < 3600000) return `${Math.ceil(remaining / 60000)}m`;
    return `${Math.ceil(remaining / 3600000)}h`;
  },
};

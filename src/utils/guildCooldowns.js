const { WORK_COOLDOWN, ROB_COOLDOWN, HEIST_BASE_COOLDOWN } = require('../config');

const COOLDOWN_KEYS = ['work', 'rob', 'heist'];
const COOLDOWN_FIELD_BY_KEY = {
  work: 'workMs',
  rob: 'robMs',
  heist: 'heistBaseMs',
};

const DEFAULT_COOLDOWNS_MS = {
  work: WORK_COOLDOWN,
  rob: ROB_COOLDOWN,
  heist: HEIST_BASE_COOLDOWN,
};

const COOLDOWN_LIMITS_MINUTES = {
  work: { min: 5, max: 12 * 60 },
  rob: { min: 10, max: 24 * 60 },
  heist: { min: 5, max: 12 * 60 },
};

function normalizeCooldownKey(value) {
  const key = `${value || ''}`.toLowerCase();
  return COOLDOWN_KEYS.includes(key) ? key : null;
}

function getGuildCooldownMs(guildData, key) {
  const normalized = normalizeCooldownKey(key);
  if (!normalized) return null;
  const field = COOLDOWN_FIELD_BY_KEY[normalized];
  const override = guildData?.cooldowns?.[field];
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_COOLDOWNS_MS[normalized];
}

function formatCooldown(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function cooldownOverrideStatus(guildData, key) {
  const normalized = normalizeCooldownKey(key);
  if (!normalized) return 'default';
  const field = COOLDOWN_FIELD_BY_KEY[normalized];
  const override = guildData?.cooldowns?.[field];
  return Number.isFinite(override) && override > 0 ? 'custom' : 'default';
}

module.exports = {
  COOLDOWN_KEYS,
  COOLDOWN_FIELD_BY_KEY,
  DEFAULT_COOLDOWNS_MS,
  COOLDOWN_LIMITS_MINUTES,
  normalizeCooldownKey,
  getGuildCooldownMs,
  formatCooldown,
  cooldownOverrideStatus,
};

const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: '.' },

  // Feature toggles
  features: {
    casino: { type: Boolean, default: true },
    heist: { type: Boolean, default: true },
    blackmarket: { type: Boolean, default: true },
  },

  // Admin roles that can use admin commands
  adminRoles: [String],
  disabledCommands: [{ type: String }],
  cooldowns: {
    workMs: { type: Number, default: null },
    robMs: { type: Number, default: null },
    heistBaseMs: { type: Number, default: null },
  },

  createdAt: { type: Date, default: Date.now },
});

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

guildSchema.post('findOneAndUpdate', function (doc) {
  if (doc) cache.delete(doc.guildId);
});
guildSchema.post('save', function (doc) {
  if (doc) cache.delete(doc.guildId);
});
guildSchema.post('updateOne', function () {
  const filter = this.getFilter();
  if (filter && filter.guildId) cache.delete(filter.guildId);
});

guildSchema.statics.findOrCreate = async function (guildId) {
  const now = Date.now();
  if (cache.has(guildId)) {
    const entry = cache.get(guildId);
    if (now - entry.time < CACHE_TTL) return entry.doc;
  }
  let guild = await this.findOne({ guildId });
  if (!guild) guild = await this.create({ guildId });
  if (guild) cache.set(guildId, { doc: guild, time: now });
  return guild;
};

module.exports = mongoose.model('Guild', guildSchema);

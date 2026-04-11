const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },

  // Economy
  balance: { type: Number, default: 0 },
  bank: { type: Number, default: 0 },
  chips: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },

  // Cooldowns
  lastDaily: { type: Date, default: null },
  lastWork: { type: Date, default: null },
  lastRob: { type: Date, default: null },
  heistCooldownUntil: { type: Date, default: null },
  wantedUntil: { type: Date, default: null },

  // Casino Profile
  casinoRank: { type: String, default: 'Regular' }, // Regular, High Roller, VIP, Whale
  luck: { type: Number, default: 1.0 }, // Luck modifier (Hot streak / Tilt)
  casinoBanEnds: { type: Date, default: null },

  taxEvasionHistory: {
    success: { type: Number, default: 0 },
    caught: { type: Number, default: 0 },
  },

  moderation: {
    frozen: { type: Boolean, default: false },
    freezeReason: { type: String, default: null },
    frozenAt: { type: Date, default: null },
    globallyBanned: { type: Boolean, default: false },
    globalBanReason: { type: String, default: null },
    globalBannedAt: { type: Date, default: null },
    globalBannedBy: { type: String, default: null },
  },

  // Stats
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 }, // tracks consecutive wins or losses (negative=loss)
    totalWagered: { type: Number, default: 0 },
    heistsJoined: { type: Number, default: 0 },
    heistsWon: { type: Number, default: 0 },
    blackmarketSales: { type: Number, default: 0 },
  },

  // Inventory (black market items)
  inventory: [
    {
      itemId: String,
      name: String,
      kind: { type: String, default: 'generic' },
      rarity: { type: String, default: 'common' },
      description: { type: String, default: 'No description.' },
      quantity: { type: Number, default: 1 },
      estimatedValue: { type: Number, default: 0 },
      source: { type: String, default: 'blackmarket' },
      stackable: { type: Boolean, default: true },
      stats: {
        strength: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        grit: { type: Number, default: 0 },
      },
      acquiredAt: { type: Date, default: Date.now },
    },
  ],

  heistHistory: [
    {
      target: String,
      outcome: String,
      role: String,
      payout: Number,
      strategy: String,
      heatLevel: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],

  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

userSchema.statics.findOrCreate = async function (userId, guildId) {
  return this.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
};

module.exports = mongoose.model('User', userSchema);

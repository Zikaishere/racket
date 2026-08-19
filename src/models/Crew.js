const mongoose = require('mongoose');

const crewSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  tag: { type: String, default: null },
  description: { type: String, default: null },
  leaderId: { type: String, required: true },
  members: [String],
  invites: [String],
  stats: {
    heistsWon: { type: Number, default: 0 },
    heistsLost: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

crewSchema.index({ guildId: 1, name: 1 }, { unique: true });
crewSchema.index({ guildId: 1, leaderId: 1 }, { unique: true });
crewSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('Crew', crewSchema);

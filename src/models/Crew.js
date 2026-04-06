const mongoose = require('mongoose');

const crewSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  leaderId: { type: String, required: true },
  members: [{ type: String }],
  invites: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

crewSchema.index({ guildId: 1, name: 1 }, { unique: true });
crewSchema.index({ guildId: 1, leaderId: 1 }, { unique: true });

module.exports = mongoose.model('Crew', crewSchema);

const mongoose = require('mongoose');

const portfolioSnapshotSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  value: { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now },
});

portfolioSnapshotSchema.index({ userId: 1, guildId: 1, recordedAt: -1 });

module.exports = mongoose.model('PortfolioSnapshot', portfolioSnapshotSchema);

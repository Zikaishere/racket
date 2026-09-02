const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  ticker: { type: String, required: true },
  shares: { type: Number, default: 0 },
  avgPrice: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

holdingSchema.index({ userId: 1, guildId: 1, ticker: 1 }, { unique: true });
holdingSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('StockHolding', holdingSchema);

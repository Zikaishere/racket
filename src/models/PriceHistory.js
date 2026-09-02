const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  ticker: { type: String, required: true },
  price: { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now },
});

priceHistorySchema.index({ ticker: 1, recordedAt: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);

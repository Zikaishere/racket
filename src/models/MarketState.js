const mongoose = require('mongoose');

const marketStateSchema = new mongoose.Schema({
  ticker: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  prevPrice: { type: Number, default: 0 },
  supply: { type: Number, default: 0 },
  lastEvent: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MarketState', marketStateSchema);

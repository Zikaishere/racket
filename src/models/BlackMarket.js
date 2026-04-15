const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  sellerId: { type: String, required: true },
  itemName: { type: String, required: true },
  itemDesc: { type: String, default: 'No description.' },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  expiresAt: { type: Date, required: true },
  sold: { type: Boolean, default: false },
  buyerId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

listingSchema.index({ guildId: 1, sold: 1, expiresAt: 1 });
listingSchema.index({ guildId: 1, sold: 1, createdAt: -1 });
listingSchema.index({ sellerId: 1, guildId: 1, sold: 1, createdAt: -1 });

module.exports = mongoose.model('BlackMarket', listingSchema);

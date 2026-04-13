const mongoose = require('mongoose');

const pendingGameSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  game: { type: String, required: true },
  gameKey: { type: String, required: true },
  currency: { type: String, enum: ['wallet', 'balance', 'chips'], required: true },
  amount: { type: Number, required: true, min: 1 },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

pendingGameSchema.index({ userId: 1, guildId: 1, gameKey: 1, currency: 1 }, { unique: true });
pendingGameSchema.index({ gameKey: 1 });

module.exports = mongoose.model('PendingGame', pendingGameSchema);

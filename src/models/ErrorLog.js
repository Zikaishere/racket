const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  errorId: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  commandName: { type: String, default: null },
  userId: { type: String, default: null },
  guildId: { type: String, default: null },
  channelId: { type: String, default: null },
  interactionType: { type: String, default: null },
  message: { type: String, default: 'Unknown error' },
  stack: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

errorLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);

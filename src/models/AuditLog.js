const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  guildId: { type: String, default: null },
  actorId: { type: String, default: null },
  targetId: { type: String, default: null },
  action: { type: String, required: true },
  amount: { type: Number, default: null },
  currency: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

auditLogSchema.index({ guildId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

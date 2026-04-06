const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId:  { type: String, required: true, unique: true },
  prefix:   { type: String, default: '.' },
  
  // Feature toggles
  features: {
    casino:     { type: Boolean, default: true },
    heist:      { type: Boolean, default: true },
    blackmarket:{ type: Boolean, default: true },
  },

  // Admin roles that can use admin commands
  adminRoles: [String],
  disabledCommands: [{ type: String }],

  createdAt: { type: Date, default: Date.now },
});

guildSchema.statics.findOrCreate = async function(guildId) {
  let guild = await this.findOne({ guildId });
  if (!guild) guild = await this.create({ guildId });
  return guild;
};

module.exports = mongoose.model('Guild', guildSchema);

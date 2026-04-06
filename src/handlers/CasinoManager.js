class CasinoManager {
  constructor() {
    this.liveFeed = {}; // guildId -> Array of strings
    this.tables = new Map(); // guildId -> Map(tableId -> state)
  }

  addHighlight(guildId, message) {
    if (!this.liveFeed[guildId]) this.liveFeed[guildId] = [];
    this.liveFeed[guildId].unshift({ time: Date.now(), msg: message });
    if (this.liveFeed[guildId].length > 5) this.liveFeed[guildId].pop();
  }

  getHighlights(guildId) {
    if (!this.liveFeed[guildId] || this.liveFeed[guildId].length === 0) return '*The casino floor is quiet...*';
    return this.liveFeed[guildId].map(h => `\`[${new Date(h.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]\` ${h.msg}`).join('\n');
  }

  // --- Table Management ---
  createTableId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  addTable(guildId, tableId, state) {
    if (!this.tables.has(guildId)) this.tables.set(guildId, new Map());
    this.tables.get(guildId).set(tableId, state);
  }

  getTable(guildId, tableId) {
    return this.tables.get(guildId)?.get(tableId);
  }
  
  deleteTable(guildId, tableId) {
    this.tables.get(guildId)?.delete(tableId);
  }

  getActiveTables(guildId) {
    if (!this.tables.has(guildId)) return [];
    return Array.from(this.tables.get(guildId).entries()).map(([id, state]) => ({ id, ...state }));
  }
}

// Singleton export
module.exports = new CasinoManager();

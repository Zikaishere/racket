require('dotenv').config();
const mongoose = require('mongoose');

async function addIndexes() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);

  console.log('\nAdding indexes...\n');

  const User = require('../src/models/User');
  const BlackMarket = require('../src/models/BlackMarket');
  const Crew = require('../src/models/Crew');
  const AuditLog = require('../src/models/AuditLog');
  const PendingGame = require('../src/models/PendingGame');

  const indexes = [
    { model: User, name: 'User.guildId', spec: { guildId: 1 } },
    { model: User, name: 'User.guildId_totalEarned', spec: { guildId: 1, totalEarned: -1 } },
    { model: User, name: 'User.guildId_stats.totalWagered', spec: { guildId: 1, 'stats.totalWagered': -1 } },
    { model: User, name: 'User.guildId_stats.heistsWon', spec: { guildId: 1, 'stats.heistsWon': -1 } },
    { model: BlackMarket, name: 'BlackMarket.guildId_sold_createdAt', spec: { guildId: 1, sold: 1, createdAt: -1 } },
    {
      model: BlackMarket,
      name: 'BlackMarket.sellerId_guildId_sold_createdAt',
      spec: { sellerId: 1, guildId: 1, sold: 1, createdAt: -1 },
    },
    { model: Crew, name: 'Crew.guildId_createdAt', spec: { guildId: 1, createdAt: -1 } },
    { model: AuditLog, name: 'AuditLog.action_createdAt', spec: { action: 1, createdAt: -1 } },
    { model: PendingGame, name: 'PendingGame.createdAt', spec: { createdAt: 1 } },
  ];

  let added = 0;
  let skipped = 0;

  for (const idx of indexes) {
    try {
      const existingIndexes = await idx.model.collection.indexes();
      const exists = existingIndexes.some((i) => i.name === idx.name);

      if (exists) {
        console.log(`  ⏭️  ${idx.name} - already exists`);
        skipped++;
      } else {
        await idx.model.collection.createIndex(idx.spec, { name: idx.name, background: true });
        console.log(`  ✅ ${idx.name} - created`);
        added++;
      }
    } catch (error) {
      if (error.code === 85 || error.code === 86) {
        console.log(`  ⏭️  ${idx.name} - index already exists with different spec`);
        skipped++;
      } else {
        console.error(`  ❌ ${idx.name} - ${error.message}`);
      }
    }
  }

  console.log(`\nDone! ${added} indexes added, ${skipped} skipped.\n`);

  await mongoose.disconnect();
  process.exit(0);
}

addIndexes().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const mongoose = require('mongoose');
const CommandHandler = require('./handlers/CommandHandler.js');
const EventHandler = require('./handlers/EventHandler.js');
const { validateRequiredEnv } = require('./utils/startup.js');
const { refundAllPendingGameFunds } = require('./utils/gameFunds.js');
const User = require('./models/User');
const BlackMarket = require('./models/BlackMarket');
const Crew = require('./models/Crew');
const AuditLog = require('./models/AuditLog');
const PendingGame = require('./models/PendingGame');
const { logError } = require('./utils/errorManager.js');

const envErrors = validateRequiredEnv(process.env);
if (envErrors.length) {
  console.error('Startup validation failed:');
  for (const error of envErrors) console.error(`- ${error}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel],
});

console.log('\nStarting Racket...\n');
console.log('Loading commands...');
new CommandHandler(client).load();

console.log('Loading events...');
new EventHandler(client).load();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('\nConnected to MongoDB\n');

    const refundedReservations = await refundAllPendingGameFunds();
    if (refundedReservations > 0) {
      console.log(`Refunded ${refundedReservations} pending game reservation(s) from the previous session.`);
    }

    console.log('Ensuring indexes...');
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
    for (const idx of indexes) {
      try {
        const exists = (await idx.model.collection.indexes()).some((i) => i.name === idx.name);
        if (!exists) {
          await idx.model.collection.createIndex(idx.spec, { name: idx.name, background: true });
        }
      } catch (err) {
        if (err.code !== 85 && err.code !== 86) console.error(`Index ${idx.name}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

connectDB().then(() => {
  client.login(process.env.BOT_TOKEN).catch((err) => {
    console.error('Login failed:', err);
    process.exit(1);
  });
});

process.on('unhandledRejection', async (err) => {
  await logError(err, { source: 'process_unhandledRejection' }, client);
});

process.on('uncaughtException', async (err) => {
  await logError(err, { source: 'process_uncaughtException' }, client);
});

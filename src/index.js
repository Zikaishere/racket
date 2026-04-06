require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const mongoose = require('mongoose');
const CommandHandler = require('./handlers/CommandHandler.js');
const EventHandler = require('./handlers/EventHandler.js');
const { validateRequiredEnv } = require('./utils/startup.js');
const { refundAllPendingGameFunds } = require('./utils/gameFunds.js');

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
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\nConnected to MongoDB\n');

    const refundedReservations = await refundAllPendingGameFunds();
    if (refundedReservations > 0) {
      console.log(`Refunded ${refundedReservations} pending game reservation(s) from the previous session.`);
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

connectDB().then(() => {
  client.login(process.env.BOT_TOKEN).catch(err => {
    console.error('Login failed:', err);
    process.exit(1);
  });
});

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});
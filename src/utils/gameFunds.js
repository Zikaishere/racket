const PendingGame = require('../models/PendingGame');
const User = require('../models/User');

function getCurrencyField(currency) {
  return currency === 'chips' ? 'chips' : 'wallet';
}

function normalizeCurrency(currency) {
  return currency === 'balance' ? 'wallet' : currency;
}

async function reserveFunds({ userId, guildId, game, gameKey, currency, amount, metadata = {} }) {
  const normalizedCurrency = normalizeCurrency(currency);
  const field = getCurrencyField(normalizedCurrency);
  const user = await User.findOrCreate(userId, guildId);
  if ((user[field] || 0) < amount) return false;
  user[field] -= amount;
  if (field === 'wallet') {
    user.balance = user.wallet;
  }
  await user.save();

  await PendingGame.findOneAndUpdate(
    { userId, guildId, gameKey, currency: normalizedCurrency },
    {
      $setOnInsert: { userId, guildId, game, gameKey, currency: normalizedCurrency },
      $inc: { amount },
      $set: { metadata, updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return true;
}

async function settleReservation({ userId, guildId, gameKey, currency = null }) {
  const query = { userId, guildId, gameKey };
  if (currency) {
    query.currency = normalizeCurrency(currency);
  }
  await PendingGame.deleteMany(query);
}

async function settleReservationsByGameKey(gameKey) {
  await PendingGame.deleteMany({ gameKey });
}

async function refundReservations({ gameKey }) {
  const reservations = await PendingGame.find({ gameKey });

  for (const reservation of reservations) {
    const field = getCurrencyField(reservation.currency);
    const user = await User.findOrCreate(reservation.userId, reservation.guildId);
    user[field] += reservation.amount;
    if (field === 'wallet') {
      user.balance = user.wallet;
    }
    await user.save();
  }

  if (reservations.length) {
    await PendingGame.deleteMany({ gameKey });
  }

  return reservations.length;
}

async function refundReservation({ userId, guildId, gameKey, currency = null }) {
  const query = { userId, guildId, gameKey };
  if (currency) {
    query.currency = normalizeCurrency(currency);
  }

  const reservations = await PendingGame.find(query);
  for (const reservation of reservations) {
    const field = getCurrencyField(reservation.currency);
    const user = await User.findOrCreate(reservation.userId, reservation.guildId);
    user[field] += reservation.amount;
    if (field === 'wallet') {
      user.balance = user.wallet;
    }
    await user.save();
  }

  if (reservations.length) {
    await PendingGame.deleteMany(query);
  }

  return reservations.length;
}

async function refundAllPendingGameFunds() {
  const reservations = await PendingGame.find({});

  for (const reservation of reservations) {
    const field = getCurrencyField(reservation.currency);
    const user = await User.findOrCreate(reservation.userId, reservation.guildId);
    user[field] += reservation.amount;
    if (field === 'wallet') {
      user.balance = user.wallet;
    }
    await user.save();
  }

  if (reservations.length) {
    await PendingGame.deleteMany({});
  }

  return reservations.length;
}

module.exports = {
  reserveFunds,
  settleReservation,
  settleReservationsByGameKey,
  refundReservation,
  refundReservations,
  refundAllPendingGameFunds,
};

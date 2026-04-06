const PendingGame = require('../models/PendingGame');
const User = require('../models/User');

function getCurrencyField(currency) {
  return currency === 'chips' ? 'chips' : 'balance';
}

async function reserveFunds({ userId, guildId, game, gameKey, currency, amount, metadata = {} }) {
  const field = getCurrencyField(currency);
  const debitResult = await User.updateOne(
    { userId, guildId, [field]: { $gte: amount } },
    { $inc: { [field]: -amount } }
  );

  if (debitResult.modifiedCount !== 1) {
    return false;
  }

  await PendingGame.findOneAndUpdate(
    { userId, guildId, gameKey, currency },
    {
      $setOnInsert: { userId, guildId, game, gameKey, currency },
      $inc: { amount },
      $set: { metadata, updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return true;
}

async function settleReservation({ userId, guildId, gameKey, currency = null }) {
  const query = { userId, guildId, gameKey };
  if (currency) {
    query.currency = currency;
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
    await User.findOneAndUpdate(
      { userId: reservation.userId, guildId: reservation.guildId },
      {
        $setOnInsert: { userId: reservation.userId, guildId: reservation.guildId },
        $inc: { [field]: reservation.amount },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  if (reservations.length) {
    await PendingGame.deleteMany({ gameKey });
  }

  return reservations.length;
}

async function refundReservation({ userId, guildId, gameKey, currency = null }) {
  const query = { userId, guildId, gameKey };
  if (currency) {
    query.currency = currency;
  }

  const reservations = await PendingGame.find(query);
  for (const reservation of reservations) {
    const field = getCurrencyField(reservation.currency);
    await User.findOneAndUpdate(
      { userId: reservation.userId, guildId: reservation.guildId },
      {
        $setOnInsert: { userId: reservation.userId, guildId: reservation.guildId },
        $inc: { [field]: reservation.amount },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
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
    await User.findOneAndUpdate(
      { userId: reservation.userId, guildId: reservation.guildId },
      {
        $setOnInsert: { userId: reservation.userId, guildId: reservation.guildId },
        $inc: { [field]: reservation.amount },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
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

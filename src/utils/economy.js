const User = require('../models/User');
const { CURRENCY_SYMBOL, CURRENCY_NAME, RANK_THRESHOLDS } = require('../config');

function fmt(amount) {
  return `${CURRENCY_SYMBOL} **${Number(amount || 0).toLocaleString()}** ${CURRENCY_NAME}`;
}

async function getUser(userId, guildId) {
  return User.findOrCreate(userId, guildId);
}

async function addBalance(userId, guildId, amount) {
  await User.findOneAndUpdate(
    { userId, guildId },
    {
      $setOnInsert: { userId, guildId },
      $inc: {
        balance: amount,
        totalEarned: amount > 0 ? amount : 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const user = await getUser(userId, guildId);
  return user.balance;
}

async function removeBalance(userId, guildId, amount) {
  const result = await User.updateOne({ userId, guildId, balance: { $gte: amount } }, { $inc: { balance: -amount } });

  if (result.modifiedCount !== 1) return false;
  const user = await getUser(userId, guildId);
  return user.balance;
}

async function deposit(userId, guildId, amount) {
  const result = await User.updateOne(
    { userId, guildId, balance: { $gte: amount } },
    { $inc: { balance: -amount, bank: amount } },
  );

  return result.modifiedCount === 1;
}

async function withdraw(userId, guildId, amount) {
  const result = await User.updateOne(
    { userId, guildId, bank: { $gte: amount } },
    { $inc: { bank: -amount, balance: amount } },
  );

  return result.modifiedCount === 1;
}

async function addChips(userId, guildId, amount) {
  await User.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId }, $inc: { chips: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const user = await getUser(userId, guildId);
  return user.chips;
}

async function removeChips(userId, guildId, amount) {
  const result = await User.updateOne({ userId, guildId, chips: { $gte: amount } }, { $inc: { chips: -amount } });

  if (result.modifiedCount !== 1) return false;
  const user = await getUser(userId, guildId);
  return user.chips;
}

async function transfer(fromId, toId, guildId, amount) {
  const debitResult = await User.updateOne(
    { userId: fromId, guildId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
  );

  if (debitResult.modifiedCount !== 1) {
    return false;
  }

  await User.findOneAndUpdate(
    { userId: toId, guildId },
    { $setOnInsert: { userId: toId, guildId }, $inc: { balance: amount, totalEarned: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return true;
}

async function hasBalance(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  return user.balance >= amount;
}

async function hasChips(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  return user.chips >= amount;
}

async function recordGame(userId, guildId, won, wagered) {
  const user = await getUser(userId, guildId);

  user.stats.gamesPlayed += 1;
  if (won) user.stats.gamesWon += 1;
  user.stats.totalWagered += wagered;

  if (won) {
    user.stats.currentStreak = user.stats.currentStreak > 0 ? user.stats.currentStreak + 1 : 1;
  } else {
    user.stats.currentStreak = user.stats.currentStreak < 0 ? user.stats.currentStreak - 1 : -1;
  }

  if (user.stats.currentStreak >= 3) {
    user.luck = 1.05;
  } else if (user.stats.currentStreak <= -3) {
    user.luck = 0.95;
  } else {
    user.luck = 1.0;
  }

  let newRank = 'Regular';
  if (user.stats.totalWagered >= RANK_THRESHOLDS.Whale) newRank = 'Whale';
  else if (user.stats.totalWagered >= RANK_THRESHOLDS.VIP) newRank = 'VIP';
  else if (user.stats.totalWagered >= RANK_THRESHOLDS['High Roller']) newRank = 'High Roller';

  user.casinoRank = newRank;
  await user.save();
}

module.exports = {
  fmt,
  addBalance,
  removeBalance,
  deposit,
  withdraw,
  addChips,
  removeChips,
  transfer,
  getUser,
  hasBalance,
  hasChips,
  recordGame,
};

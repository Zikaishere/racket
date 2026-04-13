const User = require('../models/User');
const { CURRENCY_SYMBOL, CURRENCY_NAME, RANK_THRESHOLDS } = require('../config');

function fmt(amount) {
  return `${CURRENCY_SYMBOL} **${Number(amount || 0).toLocaleString()}** ${CURRENCY_NAME}`;
}

async function getUser(userId, guildId) {
  return User.findOrCreate(userId, guildId);
}

async function addWallet(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  user.wallet += amount;
  user.balance = user.wallet;
  if (amount > 0) {
    user.totalEarned += amount;
  }
  await user.save();
  return user.wallet;
}

async function removeWallet(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  if (user.wallet < amount) return false;
  user.wallet -= amount;
  user.balance = user.wallet;
  await user.save();
  return user.wallet;
}

async function deposit(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  if (user.wallet < amount) return false;
  user.wallet -= amount;
  user.balance = user.wallet;
  user.bank += amount;
  await user.save();
  return true;
}

async function withdraw(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  if (user.bank < amount) return false;
  user.bank -= amount;
  user.wallet += amount;
  user.balance = user.wallet;
  await user.save();
  return true;
}

async function addChips(userId, guildId, amount) {
  const user = await User.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId }, $inc: { chips: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return user.chips;
}

async function removeChips(userId, guildId, amount) {
  const user = await User.findOneAndUpdate(
    { userId, guildId, chips: { $gte: amount } },
    { $inc: { chips: -amount } },
    { new: true },
  );

  if (!user) return false;
  return user.chips;
}

async function transfer(fromId, toId, guildId, amount) {
  const sender = await getUser(fromId, guildId);
  if (sender.wallet < amount) return false;

  const recipient = await getUser(toId, guildId);
  sender.wallet -= amount;
  sender.balance = sender.wallet;
  recipient.wallet += amount;
  recipient.balance = recipient.wallet;
  recipient.totalEarned += amount;
  await sender.save();
  await recipient.save();
  return true;
}

async function hasWallet(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  return user.wallet >= amount;
}

async function hasChips(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  return user.chips >= amount;
}

async function recordGame(userId, guildId, won, wagered) {
  await User.findOneAndUpdate(
    { userId, guildId },
    [
      {
        $set: {
          userId: { $ifNull: ['$userId', userId] },
          guildId: { $ifNull: ['$guildId', guildId] },
          'stats.gamesPlayed': { $add: [{ $ifNull: ['$stats.gamesPlayed', 0] }, 1] },
          'stats.gamesWon': { $add: [{ $ifNull: ['$stats.gamesWon', 0] }, won ? 1 : 0] },
          'stats.totalWagered': { $add: [{ $ifNull: ['$stats.totalWagered', 0] }, wagered] },
          'stats.currentStreak': {
            $let: {
              vars: { streak: { $ifNull: ['$stats.currentStreak', 0] } },
              in: won
                ? { $cond: [{ $gt: ['$$streak', 0] }, { $add: ['$$streak', 1] }, 1] }
                : { $cond: [{ $lt: ['$$streak', 0] }, { $subtract: ['$$streak', 1] }, -1] },
            },
          },
        },
      },
      {
        $set: {
          luck: {
            $switch: {
              branches: [
                { case: { $gte: ['$stats.currentStreak', 3] }, then: 1.05 },
                { case: { $lte: ['$stats.currentStreak', -3] }, then: 0.95 },
              ],
              default: 1.0,
            },
          },
          casinoRank: {
            $switch: {
              branches: [
                { case: { $gte: ['$stats.totalWagered', RANK_THRESHOLDS.Whale] }, then: 'Whale' },
                { case: { $gte: ['$stats.totalWagered', RANK_THRESHOLDS.VIP] }, then: 'VIP' },
                { case: { $gte: ['$stats.totalWagered', RANK_THRESHOLDS['High Roller']] }, then: 'High Roller' },
              ],
              default: 'Regular',
            },
          },
        },
      },
    ],
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

module.exports = {
  fmt,
  addWallet,
  removeWallet,
  deposit,
  withdraw,
  addChips,
  removeChips,
  transfer,
  getUser,
  hasWallet,
  hasChips,
  recordGame,
  addBalance: addWallet,
  removeBalance: removeWallet,
  hasBalance: hasWallet,
};

const User = require('../models/User');
const { CURRENCY_SYMBOL, CURRENCY_NAME, RANK_THRESHOLDS } = require('../config');

// Round a raq amount to at most 2 decimal places, trimming trailing zeros.
function roundRaq(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function fmt(amount) {
  const rounded = roundRaq(amount);
  return `${CURRENCY_SYMBOL} **${rounded.toLocaleString('en-US', { maximumFractionDigits: 2 })}** ${CURRENCY_NAME}`;
}

async function getUser(userId, guildId) {
  return User.findOrCreate(userId, guildId);
}

async function addWallet(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  const ra = roundRaq(amount);
  user.wallet = roundRaq(user.wallet) + ra;
  user.balance = user.wallet;
  if (ra > 0) {
    user.totalEarned = roundRaq(user.totalEarned) + ra;
  }
  await user.save();
  return user.wallet;
}

async function removeWallet(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  const ra = roundRaq(amount);
  if (user.wallet < ra) return false;
  user.wallet = roundRaq(user.wallet) - ra;
  user.balance = user.wallet;
  await user.save();
  return user.wallet;
}

async function deposit(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  const ra = roundRaq(amount);
  if (user.wallet < ra) return false;
  user.wallet = roundRaq(user.wallet) - ra;
  user.balance = user.wallet;
  user.bank = roundRaq(user.bank) + ra;
  await user.save();
  return true;
}

async function withdraw(userId, guildId, amount) {
  const user = await getUser(userId, guildId);
  const ra = roundRaq(amount);
  if (user.bank < ra) return false;
  user.bank = roundRaq(user.bank) - ra;
  user.wallet = roundRaq(user.wallet) + ra;
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
  const ra = roundRaq(amount);
  if (sender.wallet < ra) return false;

  const recipient = await getUser(toId, guildId);
  sender.wallet = roundRaq(sender.wallet) - ra;
  sender.balance = sender.wallet;
  recipient.wallet = roundRaq(recipient.wallet) + ra;
  recipient.balance = recipient.wallet;
  recipient.totalEarned = roundRaq(recipient.totalEarned) + ra;
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
  roundRaq,
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

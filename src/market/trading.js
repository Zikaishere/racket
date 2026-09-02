const User = require('../models/User');
const StockHolding = require('../models/StockHolding');
const MarketManager = require('./MarketManager');

// Deduct funds from wallet and return true if successful, atomically.
async function spendWallet(userId, guildId, amount) {
  const user = await User.findOneAndUpdate(
    { userId, guildId, wallet: { $gte: amount } },
    { $inc: { wallet: -amount, balance: -amount } },
    { new: true },
  );
  return user || false;
}

// Buy shares: deduct funds, then increase holding (weighted-average cost basis).
async function buyShares(userId, guildId, ticker, shares) {
  const stock = MarketManager.getStock(ticker);
  if (!stock) return { ok: false, error: 'Unknown ticker.' };

  const price = MarketManager.getPrice(ticker);
  if (price <= 0 || shares <= 0) return { ok: false, error: 'Invalid trade.' };

  const totalCost = Math.round(price * shares * 100) / 100;

  const funded = await spendWallet(userId, guildId, totalCost);
  if (!funded) return { ok: false, error: 'Insufficient wallet balance.' };

  const holding = await StockHolding.findOneAndUpdate(
    { userId, guildId, ticker },
    {
      $setOnInsert: { userId, guildId, ticker, shares: 0, avgPrice: 0 },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const oldShares = holding.shares || 0;
  const oldCost = oldShares * (holding.avgPrice || 0);
  const newShares = oldShares + shares;
  const newAvg = newShares > 0 ? (oldCost + totalCost) / newShares : 0;

  await StockHolding.updateOne({ userId, guildId, ticker }, { $set: { shares: newShares, avgPrice: newAvg } });

  return { ok: true, price, totalCost, totalPrice: price * newShares, costBasis: newAvg * newShares };
}

// Sell shares: check ownership, then refund proceeds to wallet.
async function sellShares(userId, guildId, ticker, shares) {
  const stock = MarketManager.getStock(ticker);
  if (!stock) return { ok: false, error: 'Unknown ticker.' };

  if (shares <= 0) return { ok: false, error: 'Invalid trade.' };

  const holding = await StockHolding.findOne({ userId, guildId, ticker });
  const owned = holding ? holding.shares || 0 : 0;
  if (owned < shares) {
    return { ok: false, error: `You only own ${owned} share(s) of ${ticker}.` };
  }

  const price = MarketManager.getPrice(ticker);
  const proceeds = Math.round(price * shares * 100) / 100;

  const newShares = owned - shares;
  await StockHolding.updateOne(
    { userId, guildId, ticker },
    newShares > 0 ? { $set: { shares: newShares, updatedAt: new Date() } } : { $inc: { shares: -shares } },
  );
  if (newShares <= 0) {
    await StockHolding.deleteOne({ userId, guildId, ticker });
  }

  await User.findOneAndUpdate(
    { userId, guildId },
    { $inc: { wallet: proceeds, balance: proceeds, totalEarned: proceeds } },
  );

  return { ok: true, price, proceeds, profit: proceeds - shares * (holding.avgPrice || 0) };
}

// Get all holdings for a user with current market valuation.
async function getUserPortfolio(userId, guildId) {
  const holdings = await StockHolding.find({ userId, guildId }).lean();
  let invested = 0;
  let currentValue = 0;

  const rows = holdings.map((h) => {
    const price = MarketManager.getPrice(h.ticker);
    const value = price * h.shares;
    const costBasis = (h.avgPrice || 0) * h.shares;
    invested += costBasis;
    currentValue += value;
    return {
      ticker: h.ticker,
      shares: h.shares,
      avgPrice: h.avgPrice || 0,
      currentPrice: price,
      value,
      costBasis,
      pnl: value - costBasis,
      change: h.avgPrice ? ((price - h.avgPrice) / h.avgPrice) * 100 : 0,
    };
  });

  const pnl = currentValue - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

  return { rows, invested, currentValue, pnl, pnlPercent };
}

module.exports = {
  buyShares,
  sellShares,
  getUserPortfolio,
};

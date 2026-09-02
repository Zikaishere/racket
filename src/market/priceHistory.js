const PriceHistory = require('../models/PriceHistory');

const MAX_POINTS_PER_STOCK = 240; // ~4 hours at 1 min/tick

// Record a snapshot for all stocks. Called once per market tick.
async function recordSnapshot(prices) {
  const now = new Date();
  const docs = [];
  for (const [ticker, state] of prices) {
    docs.push({ ticker, price: state.price, recordedAt: now });
  }
  if (docs.length) await PriceHistory.insertMany(docs);

  // Prune old records to keep the collection bounded.
  await PriceHistory.deleteMany({
    recordedAt: { $lt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
  });
}

// Get recent price points for a single ticker, oldest -> newest, limited to points.
async function getHistory(ticker, points = 60) {
  const docs = await PriceHistory.find({ ticker }).sort({ recordedAt: -1 }).limit(points).lean();
  return docs.reverse().map((d) => ({ price: d.price, t: d.recordedAt }));
}

module.exports = { recordSnapshot, getHistory, MAX_POINTS_PER_STOCK };

const PortfolioSnapshot = require('../models/PortfolioSnapshot');

const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000; // record at most every 5 min per user

// Record a portfolio value point (throttled) and prune old ones.
async function recordPortfolio(userId, guildId, value) {
  const last = await PortfolioSnapshot.findOne({ userId, guildId }).sort({ recordedAt: -1 }).lean();
  if (last && Date.now() - new Date(last.recordedAt).getTime() < SNAPSHOT_THROTTLE_MS) {
    return;
  }
  await PortfolioSnapshot.create({ userId, guildId, value, recordedAt: new Date() });

  await PortfolioSnapshot.deleteMany({
    userId,
    guildId,
    recordedAt: { $lt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
  });
}

async function getPortfolioHistory(userId, guildId, points = 60) {
  const docs = await PortfolioSnapshot.find({ userId, guildId }).sort({ recordedAt: -1 }).limit(points).lean();
  return docs.reverse().map((d) => ({ value: d.value, t: d.recordedAt }));
}

module.exports = { recordPortfolio, getPortfolioHistory, SNAPSHOT_THROTTLE_MS };

const MarketState = require('../models/MarketState');
const { recordSnapshot } = require('./priceHistory');
const {
  STOCKS,
  SECTOR_LABELS,
  TICK_INTERVAL_MS,
  PRICE_MIN_FACTOR,
  PRICE_MAX_FACTOR,
  MEAN_REVERSION_STRENGTH,
  EVENT_CHANCE,
  EVENTS,
} = require('./stocks');

// Controlled randomness: box-muller-ish gaussian clamped to [-1, 1]
function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.max(-1, Math.min(1, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
}

function pickEvent() {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}

class MarketManager {
  constructor() {
    this.prices = new Map(); // ticker -> { price, prevPrice, supply }
    this.started = false;
    this.timer = null;
  }

  // Clamp price within [base*minFactor, base*maxFactor] of its base to prevent runaways
  clampPrice(stock, price) {
    const min = stock.basePrice * PRICE_MIN_FACTOR;
    const max = stock.basePrice * PRICE_MAX_FACTOR;
    return Math.max(min, Math.min(max, price));
  }

  // Load persisted prices, or seed new ones from base prices
  async initialize() {
    const saved = await MarketState.find({}).lean();
    const savedMap = new Map(saved.map((s) => [s.ticker, s]));

    let changed = false;
    for (const stock of STOCKS) {
      const record = savedMap.get(stock.ticker);
      if (record) {
        this.prices.set(stock.ticker, {
          price: record.price,
          prevPrice: record.prevPrice,
          supply: record.supply,
        });
      } else {
        // Seed with a small random offset so not everyone's market starts identical
        const seeded = stock.basePrice * (0.9 + Math.random() * 0.2);
        this.prices.set(stock.ticker, {
          price: seeded,
          prevPrice: seeded,
          supply: 100000 + Math.floor(Math.random() * 100000),
        });
        changed = true;
      }
    }

    if (changed) {
      await this.persist();
      // Backfill price history for any newly-added stock so it appears on charts
      // immediately, even before the first market tick records a snapshot.
      await this.backfillHistory();
    }
    this.started = true;
    return true;
  }

  async persist() {
    const updates = [];
    for (const [ticker, state] of this.prices) {
      updates.push({
        updateOne: {
          filter: { ticker },
          update: {
            $set: { price: state.price, prevPrice: state.prevPrice, supply: state.supply, updatedAt: new Date() },
          },
          upsert: true,
        },
      });
    }
    if (updates.length) await MarketState.bulkWrite(updates);
  }

  // For any stock with fewer than 2 recorded points, insert initial points so
  // charting (which requires >=2 points per sector) shows it right away — even
  // before the first real market tick records a snapshot.
  async backfillHistory() {
    const PriceHistory = require('../models/PriceHistory');
    const counts = await PriceHistory.aggregate([
      { $group: { _id: '$ticker', n: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c.n]));

    const docs = [];
    const now = Date.now();
    for (const stock of STOCKS) {
      if ((countMap.get(stock.ticker) || 0) >= 2) continue;
      const state = this.prices.get(stock.ticker);
      const price = state ? state.price : stock.basePrice;
      // Two points a few minutes apart so the % change baseline is non-zero.
      const earlier = price * (0.99 + Math.random() * 0.02);
      docs.push(
        { ticker: stock.ticker, price: earlier, recordedAt: new Date(now - 5 * 60 * 1000) },
        { ticker: stock.ticker, price, recordedAt: new Date(now) },
      );
    }

    if (docs.length) await PriceHistory.insertMany(docs);
  }

  getStock(ticker) {
    return STOCKS.find((s) => s.ticker === ticker) || null;
  }

  getPrice(ticker) {
    const state = this.prices.get(ticker);
    return state ? state.price : 0;
  }

  getPrevPrice(ticker) {
    const state = this.prices.get(ticker);
    return state ? state.prevPrice : 0;
  }

  getSupply(ticker) {
    const state = this.prices.get(ticker);
    return state ? state.supply : 0;
  }

  getChangePercent(ticker) {
    const state = this.prices.get(ticker);
    if (!state || !state.prevPrice) return 0;
    return ((state.price - state.prevPrice) / state.prevPrice) * 100;
  }

  // Advance all prices one tick. Optionally trigger an economic event.
  async tick() {
    if (!this.started) return;

    let event = null;
    if (Math.random() < EVENT_CHANCE) {
      event = pickEvent();
    }

    const labels = SECTOR_LABELS;

    for (const stock of STOCKS) {
      const state = this.prices.get(stock.ticker) || {
        price: stock.basePrice,
        prevPrice: stock.basePrice,
        supply: 100000,
      };
      state.prevPrice = state.price;

      let drift = gaussian() * stock.volatility;

      // Apply sector-wide or market-wide event effects
      if (event && (event.sector === null || event.sector === stock.sector)) {
        drift += event.intensity * stock.volatility * 6;
      }

      // Mean reversion: nudge price back toward base so it doesn't drift forever
      const pull = (stock.basePrice - state.price) / stock.basePrice;
      state.price = state.price * (1 + drift) + pull * state.price * MEAN_REVERSION_STRENGTH;
      state.price = this.clampPrice(stock, state.price);

      this.prices.set(stock.ticker, state);
    }

    // Small supply drift so supply feels alive but stays bounded
    for (const stock of STOCKS) {
      const state = this.prices.get(stock.ticker);
      state.supply += Math.floor(state.supply * gaussian() * 0.001);
      state.supply = Math.max(50000, Math.min(300000, state.supply));
    }

    await this.persist();
    await recordSnapshot(this.prices);

    if (event) {
      this.lastEvent = {
        ...event,
        sectorLabel: event.sector ? labels[event.sector] : 'Market',
      };
    }
    return this.lastEvent;
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('Market tick error:', err));
    }, TICK_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  snapshot() {
    return STOCKS.map((stock) => ({
      ...stock,
      price: this.getPrice(stock.ticker),
      prevPrice: this.getPrevPrice(stock.ticker),
      change: this.getChangePercent(stock.ticker),
      supply: this.getSupply(stock.ticker),
    }));
  }
}

module.exports = new MarketManager();

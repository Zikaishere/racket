const crypto = require('crypto');

const STORE_ITEMS = {
  alley_hen: {
    id: 'alley_hen',
    name: 'Alley Hen',
    kind: 'chicken',
    rarity: 'common',
    price: 1200,
    description: 'A scrappy street chicken with average instincts and a surprisingly mean peck.',
    stats: { strength: 4, speed: 5, grit: 6 },
  },
  bruiser_rooster: {
    id: 'bruiser_rooster',
    name: 'Bruiser Rooster',
    kind: 'chicken',
    rarity: 'uncommon',
    price: 2600,
    description: 'Heavy build, loud attitude, and enough muscle to bully weaker birds.',
    stats: { strength: 8, speed: 4, grit: 7 },
  },
  razorback_rooster: {
    id: 'razorback_rooster',
    name: 'Razorback Rooster',
    kind: 'chicken',
    rarity: 'rare',
    price: 4800,
    description: 'Fast on its feet and nasty in a burst, but a little harder to keep calm.',
    stats: { strength: 7, speed: 9, grit: 6 },
  },
  ironcluck: {
    id: 'ironcluck',
    name: 'Ironcluck',
    kind: 'chicken',
    rarity: 'epic',
    price: 8200,
    description: 'Built like a tank. Not flashy, just brutally hard to put down.',
    stats: { strength: 10, speed: 6, grit: 10 },
  },
  kingfowl: {
    id: 'kingfowl',
    name: 'Kingfowl',
    kind: 'chicken',
    rarity: 'legendary',
    price: 14000,
    description: 'A feared bloodline bird with elite instincts and a nasty finishing burst.',
    stats: { strength: 11, speed: 10, grit: 11 },
  },
};

function listStoreItems() {
  return Object.values(STORE_ITEMS);
}

function getStoreItem(itemId) {
  if (!itemId) return null;
  return STORE_ITEMS[itemId.toLowerCase()] || null;
}

function createInventoryItemFromStore(item) {
  return {
    itemId: crypto.randomUUID(),
    name: item.name,
    kind: item.kind,
    rarity: item.rarity,
    description: item.description,
    quantity: 1,
    estimatedValue: item.price,
    source: 'store',
    stackable: false,
    stats: { ...item.stats },
    acquiredAt: new Date(),
  };
}

function getChickenPower(chicken) {
  const stats = chicken?.stats || {};
  return (stats.strength || 0) * 1.2 + (stats.speed || 0) + (stats.grit || 0) * 1.1;
}

module.exports = {
  STORE_ITEMS,
  listStoreItems,
  getStoreItem,
  createInventoryItemFromStore,
  getChickenPower,
};

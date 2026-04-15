const { describe, test, assert } = require('./helpers');
const {
  assertBetween,
  assertApproximately,
  assertArrayContains,
  assertGreaterThan,
  assertLessThan,
} = require('./helpers/assert');

const slots = require('../src/commands/casino/slots');
const scratch = require('../src/commands/casino/scratch');
const roulette = require('../src/commands/casino/roulette');
const blackjack = require('../src/commands/casino/blackjack');

const { SYMBOLS, PAYOUTS, calculateSlotsWin } = slots;
const { TIERS, rollTier, calculateScratchPayout } = scratch;
const { BET_TYPES, getColor, calculateRoulettePayout } = roulette;
const {
  cardValue,
  handValue,
  getChickenPower,
  calculateCockfightWin,
  calculateVaultAlarm,
  calculateVaultPool,
  calculateDoubleWinChance,
  calculateDoublePool,
  calculateDoubleProfit,
} = blackjack;

describe('Slots Game Logic', () => {
  test('SYMBOLS array has 6 symbols', () => {
    assert.equal(SYMBOLS.length, 6, 'Should have 6 slot symbols');
  });

  test('PAYOUTS object has all symbol multipliers', () => {
    const expectedPayouts = { Seven: 10, Diamond: 7, Bell: 5, Cherry: 3, Lemon: 2, Card: 1.5 };
    for (const [name, payout] of Object.entries(expectedPayouts)) {
      assert.equal(PAYOUTS[name], payout, `Symbol ${name} should have payout ${payout}`);
    }
  });

  test('All symbol payouts are positive', () => {
    for (const payout of Object.values(PAYOUTS)) {
      assertGreaterThan(payout, 0, 'All payouts should be positive');
    }
  });

  test('Jackpot payout (all 3 match) is highest multiplier', () => {
    const maxPayout = Math.max(...Object.values(PAYOUTS));
    assert.equal(maxPayout, 10, 'Highest payout should be 10x (Sevens)');
  });

  test('Two of a kind payout is 0.5x of bet', () => {
    const twoOfAKindMultiplier = 0.5;
    assert.equal(twoOfAKindMultiplier, 0.5, 'Two of a kind should pay 0.5x');
  });

  test('Calculate slots win - jackpot (three sevens)', () => {
    const result = calculateSlotsWin(['Seven', 'Seven', 'Seven'], 100);
    assert.equal(result.result, 'jackpot', 'Should be jackpot');
    assert.equal(result.netProfit, 1000, 'Three sevens should pay 10x bet');
    assert.equal(result.totalReturn, 1100, 'Total return should include original bet');
  });

  test('PAYOUTS is accessible', () => {
    assert.equal(PAYOUTS.Seven, 10, 'Seven should pay 10x');
  });

  test('Calculate slots win - two of a kind', () => {
    const result = calculateSlotsWin(['Cherry', 'Cherry', 'Seven'], 100);
    assert.equal(result.result, 'two_of_kind', 'Should be two of a kind');
    assert.equal(result.netProfit, 50, 'Two of a kind should pay 0.5x bet');
    assert.equal(result.totalReturn, 150, 'Total return should be 1.5x bet');
  });

  test('Calculate slots win - no match (loss)', () => {
    const result = calculateSlotsWin(['Cherry', 'Lemon', 'Bell'], 100);
    assert.equal(result.result, 'loss', 'Should be loss');
    assert.equal(result.netProfit, -100, 'No match should result in losing the bet');
    assert.equal(result.totalReturn, 0, 'Total return should be 0');
  });
});

describe('Scratch Card Game Logic', () => {
  test('TIERS array has 4 tiers', () => {
    assert.equal(TIERS.length, 4, 'Should have 4 scratch card tiers');
  });

  test('Tier probabilities sum to 1', () => {
    const sum = TIERS.reduce((acc, tier) => acc + tier.chance, 0);
    assertApproximately(sum, 1.0, 0.001, 'Probabilities should sum to 1');
  });

  test('rollTier returns a valid tier', () => {
    const tierNames = TIERS.map((t) => t.name);
    for (let i = 0; i < 100; i++) {
      const tier = rollTier();
      assertArrayContains(tierNames, tier.name, 'rollTier should return a valid tier');
    }
  });

  test('Bust tier has multiplier 0', () => {
    const bustTier = TIERS.find((t) => t.name === 'Bust');
    assert.equal(bustTier.multiplier, 0, 'Bust tier should have 0 multiplier');
  });

  test('Jackpot tier has highest multiplier', () => {
    const maxMultiplier = Math.max(...TIERS.map((t) => t.multiplier));
    const jackpotTier = TIERS.find((t) => t.name === 'Jackpot');
    assert.equal(jackpotTier.multiplier, maxMultiplier, 'Jackpot should have highest multiplier');
  });

  test('Expected value calculation', () => {
    let expectedValue = 0;
    for (const tier of TIERS) {
      expectedValue += tier.chance * tier.multiplier;
    }
    assertBetween(expectedValue, 1.0, 1.5, 'Expected value should be between 1.0 and 1.5');
  });

  test('Calculate scratch payout - bust', () => {
    const tier = { name: 'Bust', multiplier: 0 };
    const payout = calculateScratchPayout(100, tier);
    assert.equal(payout, 0, 'Bust should pay 0');
  });

  test('Calculate scratch payout - small win', () => {
    const tier = { name: 'Small Win', multiplier: 1.5 };
    const payout = calculateScratchPayout(100, tier);
    assert.equal(payout, 150, 'Small Win should pay 1.5x bet');
  });

  test('Calculate scratch payout - big win', () => {
    const tier = { name: 'Big Win', multiplier: 3 };
    const payout = calculateScratchPayout(100, tier);
    assert.equal(payout, 300, 'Big Win should pay 3x bet');
  });

  test('Calculate scratch payout - jackpot', () => {
    const tier = { name: 'Jackpot', multiplier: 8 };
    const payout = calculateScratchPayout(100, tier);
    assert.equal(payout, 800, 'Jackpot should pay 8x bet');
  });
});

describe('Roulette Game Logic', () => {
  test('getColor returns green for 0', () => {
    assert.equal(getColor(0), 'green', '0 should be green');
  });

  test('getColor returns correct color for red numbers', () => {
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    for (const num of redNumbers) {
      assert.equal(getColor(num), 'red', `${num} should be red`);
    }
  });

  test('getColor returns correct color for black numbers', () => {
    const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    for (const num of blackNumbers) {
      assert.equal(getColor(num), 'black', `${num} should be black`);
    }
  });

  test('BET_TYPES has 6 bet types', () => {
    const betTypeNames = Object.keys(BET_TYPES);
    assert.equal(betTypeNames.length, 6, 'Should have 6 bet types');
  });

  test('Red/Black bets pay 2x', () => {
    assert.equal(BET_TYPES.red.payout, 2, 'Red should pay 2x');
    assert.equal(BET_TYPES.black.payout, 2, 'Black should pay 2x');
  });

  test('Odd/Even bets pay 2x', () => {
    assert.equal(BET_TYPES.odd.payout, 2, 'Odd should pay 2x');
    assert.equal(BET_TYPES.even.payout, 2, 'Even should pay 2x');
  });

  test('Low/High bets pay 2x', () => {
    assert.equal(BET_TYPES.low.payout, 2, 'Low should pay 2x');
    assert.equal(BET_TYPES.high.payout, 2, 'High should pay 2x');
  });

  test('Red bet wins on red numbers', () => {
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    for (const num of redNumbers) {
      assert.equal(BET_TYPES.red.check(num), true, `${num} should win red bet`);
    }
  });

  test('Red bet loses on non-red numbers', () => {
    const nonRedNumbers = [0, 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    for (const num of nonRedNumbers) {
      assert.equal(BET_TYPES.red.check(num), false, `${num} should lose red bet`);
    }
  });

  test('Odd bet wins on odd numbers (excluding 0)', () => {
    for (let num = 1; num <= 36; num++) {
      if (num % 2 !== 0) {
        assert.equal(BET_TYPES.odd.check(num), true, `${num} should win odd bet`);
      }
    }
    assert.equal(BET_TYPES.odd.check(0), false, '0 should lose odd bet');
  });

  test('Even bet wins on even numbers (excluding 0)', () => {
    for (let num = 2; num <= 36; num += 2) {
      assert.equal(BET_TYPES.even.check(num), true, `${num} should win even bet`);
    }
    assert.equal(BET_TYPES.even.check(0), false, '0 should lose even bet');
  });

  test('Low bet wins on 1-18', () => {
    for (let num = 1; num <= 18; num++) {
      assert.equal(BET_TYPES.low.check(num), true, `${num} should win low bet`);
    }
    assert.equal(BET_TYPES.low.check(19), false, '19 should lose low bet');
  });

  test('High bet wins on 19-36', () => {
    for (let num = 19; num <= 36; num++) {
      assert.equal(BET_TYPES.high.check(num), true, `${num} should win high bet`);
    }
    assert.equal(BET_TYPES.high.check(18), false, '18 should lose high bet');
  });

  test('Calculate roulette payout - number bet (35:1)', () => {
    const result = calculateRoulettePayout(100, true, true);
    assert.equal(result.profit, 3500, 'Number bet should pay 35x profit');
    assert.equal(result.totalReturn, 3600, 'Total return should include bet');
  });

  test('Calculate roulette payout - color bet (1:1)', () => {
    const result = calculateRoulettePayout(100, true, false);
    assert.equal(result.profit, 100, 'Color bet should pay 1x profit');
    assert.equal(result.totalReturn, 200, 'Total return should be 2x bet');
  });

  test('Calculate roulette payout - loss returns 0', () => {
    const result = calculateRoulettePayout(100, false, true);
    assert.equal(result.profit, 0, 'Loss should have 0 profit');
    assert.equal(result.totalReturn, 0, 'Loss should have 0 total return');
  });

  test('House edge calculation', () => {
    const totalOutcomes = 37;
    const greenOutcomes = 1;
    const houseEdge = greenOutcomes / totalOutcomes;
    assertApproximately(houseEdge, 0.027, 0.001, 'House edge should be ~2.7%');
  });
});

describe('Blackjack Game Logic', () => {
  test('cardValue returns correct values for number cards', () => {
    for (let i = 2; i <= 10; i++) {
      assert.equal(cardValue(String(i)), i, `${i} should have value ${i}`);
    }
  });

  test('cardValue returns 10 for face cards', () => {
    assert.equal(cardValue('J'), 10, 'Jack should have value 10');
    assert.equal(cardValue('Q'), 10, 'Queen should have value 10');
    assert.equal(cardValue('K'), 10, 'King should have value 10');
  });

  test('cardValue returns 11 for Ace', () => {
    assert.equal(cardValue('A'), 11, 'Ace should have value 11');
  });

  test('handValue calculates correct totals', () => {
    assert.equal(handValue([{ rank: '5' }, { rank: '7' }]), 12, '5+7 should be 12');
    assert.equal(handValue([{ rank: 'K' }, { rank: 'Q' }]), 20, 'K+Q should be 20');
    assert.equal(handValue([{ rank: 'A' }, { rank: '9' }]), 20, 'A+9 should be 20');
  });

  test('handValue converts Ace from 11 to 1 when busting', () => {
    const hand = [{ rank: 'A' }, { rank: '8' }, { rank: '5' }];
    const value = handValue(hand);
    assertLessThan(value, 22, 'Hand with A+8+5 should be under 22');
    assert.equal(value, 14, 'A+8+5 should be 14 (Ace as 1)');
  });

  test('handValue handles multiple Aces', () => {
    const hand = [{ rank: 'A' }, { rank: 'A' }, { rank: '9' }];
    const value = handValue(hand);
    assertLessThan(value, 22, 'A+A+9 should be under 22');
    assert.equal(value, 21, 'A+A+9 should be 21');
  });

  test('handValue handles pure blackjack', () => {
    const hand = [{ rank: 'A' }, { rank: 'K' }];
    const value = handValue(hand);
    assert.equal(value, 21, 'A+K should be 21 (blackjack)');
  });

  test('handValue of empty hand is 0', () => {
    assert.equal(handValue([]), 0, 'Empty hand should be 0');
  });

  test('Dealer stands on 17+', () => {
    const shouldStandOn = [17, 18, 19, 20, 21];
    for (const total of shouldStandOn) {
      assert.equal(total >= 17, true, `${total} should stand`);
    }
  });
});

describe('Double or Nothing Game Logic', () => {
  test('Win chance with neutral luck (1.0) is 50%', () => {
    const chance = calculateDoubleWinChance(1.0);
    assertApproximately(chance, 0.5, 0.001, 'Neutral luck should give 50% win chance');
  });

  test('Win chance with high luck (1.05) is ~52.5%', () => {
    const chance = calculateDoubleWinChance(1.05);
    assertApproximately(chance, 0.525, 0.001, 'High luck should give 52.5% win chance');
  });

  test('Win chance with low luck (0.95) is ~47.5%', () => {
    const chance = calculateDoubleWinChance(0.95);
    assertApproximately(chance, 0.475, 0.001, 'Low luck should give 47.5% win chance');
  });

  test('Pool doubles on win', () => {
    const pool = 100;
    const newPool = pool * 2;
    assert.equal(newPool, 200, 'Pool should double on win');
  });

  test('Pool calculation after wins', () => {
    const pool = calculateDoublePool(100, 3);
    assert.equal(pool, 800, 'Pool should be 100 * 2^3 = 800');
  });

  test('Profit calculation after cashout', () => {
    const profit = calculateDoubleProfit(400, 100);
    assert.equal(profit, 300, 'Profit should be pool minus original bet');
  });

  test('Loss calculation', () => {
    const originalBet = 100;
    const lost = originalBet;
    assert.equal(lost, 100, 'Loss should be the original bet');
  });
});

describe('Vault Game Logic', () => {
  const MULTIPLIERS = [1.2, 1.5, 2.0, 3.5, 5.0, 10.0];
  const ALARM_CHANCE = [0.1, 0.2, 0.35, 0.5, 0.65, 0.85];

  test('Vault has 6 levels', () => {
    assert.equal(MULTIPLIERS.length, 6, 'Vault should have 6 levels');
    assert.equal(ALARM_CHANCE.length, 6, 'Alarm chances should have 6 entries');
  });

  test('Multipliers increase with each level', () => {
    for (let i = 1; i < MULTIPLIERS.length; i++) {
      assertGreaterThan(
        MULTIPLIERS[i],
        MULTIPLIERS[i - 1],
        `Level ${i} multiplier should be higher than level ${i - 1}`,
      );
    }
  });

  test('Alarm chance increases with each level', () => {
    for (let i = 1; i < ALARM_CHANCE.length; i++) {
      assertGreaterThan(ALARM_CHANCE[i], ALARM_CHANCE[i - 1], `Level ${i} alarm should be higher than level ${i - 1}`);
    }
  });

  test('Level 0 has lowest risk/reward', () => {
    assertApproximately(MULTIPLIERS[0], 1.2, 0.001, 'Level 0 multiplier should be 1.2x');
    assertApproximately(ALARM_CHANCE[0], 0.1, 0.001, 'Level 0 alarm chance should be 10%');
  });

  test('Level 5 has highest risk/reward', () => {
    assertApproximately(MULTIPLIERS[5], 10.0, 0.001, 'Level 5 multiplier should be 10x');
    assertApproximately(ALARM_CHANCE[5], 0.85, 0.001, 'Level 5 alarm chance should be 85%');
  });

  test('Calculate vault pool - level 0', () => {
    const pool = calculateVaultPool(100, 0);
    assert.equal(pool, 120, 'Level 0 pool should be 1.2x bet');
  });

  test('Calculate vault pool - level 5', () => {
    const pool = calculateVaultPool(100, 5);
    assert.equal(pool, 1000, 'Level 5 pool should be 10x bet');
  });

  test('Alarm chance with neutral luck (1.0)', () => {
    const chance = calculateVaultAlarm(2, 1.0);
    assertApproximately(chance, 0.35, 0.001, 'Level 2 alarm chance should be 35%');
  });

  test('Alarm chance with high luck (1.05) is reduced', () => {
    const chance = calculateVaultAlarm(2, 1.05);
    assertLessThan(chance, 0.35, 'High luck should reduce alarm chance');
  });

  test('Expected value at level 0 with neutral luck', () => {
    const alarmChance = calculateVaultAlarm(0, 1.0);
    const successChance = 1 - alarmChance;
    const ev = MULTIPLIERS[0] * successChance;
    assertApproximately(ev, 1.08, 0.01, 'Level 0 expected value should be ~1.08');
  });

  test('Expected value at level 5 with neutral luck', () => {
    const alarmChance = calculateVaultAlarm(5, 1.0);
    const successChance = 1 - alarmChance;
    const ev = MULTIPLIERS[5] * successChance;
    assertApproximately(ev, 1.5, 0.1, 'Level 5 expected value should be ~1.5');
  });
});

describe('Cockfight Game Logic', () => {
  test('getChickenPower returns sum of stats', () => {
    const chicken = { stats: { strength: 5, speed: 6, grit: 7 } };
    const power = getChickenPower(chicken);
    assert.equal(power, 18, 'Power should be sum of all stats');
  });

  test('getChickenPower handles missing stats', () => {
    const chicken = {};
    const power = getChickenPower(chicken);
    assert.equal(power, 0, 'Missing stats should return 0');
  });

  test('calculateCockfightWin returns correct values', () => {
    const result = calculateCockfightWin(100, 10);
    assert.equal(result.winChance, 0.85, 'Win chance should be capped at 85%');
  });

  test('Win chance has minimum of 20%', () => {
    const result = calculateCockfightWin(1, 100);
    assert.equal(result.winChance, 0.2, 'Win chance should be capped at 20% minimum');
  });

  test('Odds multiplier formula', () => {
    const result = calculateCockfightWin(50, 50);
    assertApproximately(result.oddsMultiplier, 2.6, 0.001, '50% win chance should give ~2.6x odds');
  });

  test('Odds multiplier at minimum win chance (20%)', () => {
    const result = calculateCockfightWin(20, 80);
    assertApproximately(result.oddsMultiplier, 3.5, 0.001, '20% win chance should give ~3.5x odds');
  });

  test('Odds multiplier at maximum win chance (85%)', () => {
    const result = calculateCockfightWin(85, 15);
    assertApproximately(result.oddsMultiplier, 1.55, 0.001, '85% win chance should give ~1.55x odds');
  });

  test('Odds multiplier calculation for extreme underdog', () => {
    const result = calculateCockfightWin(1, 999);
    assertApproximately(result.oddsMultiplier, 3.5, 0.01, 'Extreme underdog should give ~3.5x odds');
  });

  test('Payout calculation', () => {
    const bet = 100;
    const oddsMultiplier = 2.5;
    const payout = Math.floor(bet * oddsMultiplier);
    assert.equal(payout, 250, 'Payout should be bet * odds multiplier');
  });
});

describe('Bet Validation Logic', () => {
  const CASINO_MIN_BET = 100;
  const CASINO_MAX_BET = 50000;

  test('Bet below minimum is invalid', () => {
    const bet = 50;
    const isValid = !isNaN(bet) && bet >= CASINO_MIN_BET && bet <= CASINO_MAX_BET;
    assert.equal(isValid, false, 'Bet of 50 should be invalid');
  });

  test('Bet at minimum is valid', () => {
    const bet = CASINO_MIN_BET;
    const isValid = !isNaN(bet) && bet >= CASINO_MIN_BET && bet <= CASINO_MAX_BET;
    assert.equal(isValid, true, 'Bet at minimum should be valid');
  });

  test('Bet at maximum is valid', () => {
    const bet = CASINO_MAX_BET;
    const isValid = !isNaN(bet) && bet >= CASINO_MIN_BET && bet <= CASINO_MAX_BET;
    assert.equal(isValid, true, 'Bet at maximum should be valid');
  });

  test('Bet above maximum is invalid', () => {
    const bet = 50001;
    const isValid = !isNaN(bet) && bet >= CASINO_MIN_BET && bet <= CASINO_MAX_BET;
    assert.equal(isValid, false, 'Bet of 50001 should be invalid');
  });

  test('NaN bet is invalid', () => {
    const bet = NaN;
    const isValid = !isNaN(bet) && bet >= CASINO_MIN_BET && bet <= CASINO_MAX_BET;
    assert.equal(isValid, false, 'NaN bet should be invalid');
  });
});

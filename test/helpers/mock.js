const mockStorage = new Map();

function createMockUser(overrides = {}) {
  return {
    userId: '123456789',
    guildId: '987654321',
    wallet: 10000,
    bank: 5000,
    chips: 1000,
    luck: 1.0,
    cooldowns: {},
    stats: {
      totalWagered: 0,
      totalEarned: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      heistsWon: 0,
      heistsLost: 0,
    },
    inventory: [],
    moderation: {
      banned: false,
      frozen: false,
      globallyBanned: false,
    },
    ...overrides,
  };
}

function createMockGuild(overrides = {}) {
  return {
    guildId: '987654321',
    prefix: ';',
    features: {
      casino: true,
      heist: true,
      blackmarket: true,
    },
    disabledCommands: [],
    adminRoles: [],
    cooldowns: {},
    ...overrides,
  };
}

function createMockUserModel(mockUser) {
  const user = { ...mockUser };

  return {
    save: async () => user,
    toObject: () => ({ ...user }),
    wallet: user.wallet,
    bank: user.bank,
    chips: user.chips,
    luck: user.luck,
    cooldowns: user.cooldowns,
    stats: user.stats,
    inventory: user.inventory,
    moderation: user.moderation,
    _update: async (update) => {
      Object.assign(user, update);
      return user;
    },
  };
}

function mockDateNow(value) {
  const original = Date.now;
  Date.now = () => value;
  return () => {
    Date.now = original;
  };
}

function withMockConfig(overrides, fn) {
  const originalConfig = require('../../src/config.js');
  const mockConfig = { ...originalConfig, ...overrides };
  fn(mockConfig);
}

function createMockInteraction(overrides = {}) {
  return {
    reply: async () => {},
    editReply: async () => {},
    followUp: async () => {},
    deferReply: async () => {},
    deleteReply: async () => {},
    ephemeral: false,
    user: { id: '123456789', tag: 'TestUser#0001' },
    guild: { id: '987654321' },
    channel: { id: '111222333' },
    message: { id: '444555666' },
    values: [],
    customId: null,
    componentType: 2,
    ...overrides,
  };
}

function createMockMessage(overrides = {}) {
  return {
    reply: async () => {},
    edit: async () => {},
    delete: async () => {},
    channel: { id: '111222333' },
    author: { id: '123456789', tag: 'TestUser#0001' },
    guild: { id: '987654321' },
    content: '',
    ...overrides,
  };
}

function resetMocks() {
  mockStorage.clear();
}

function setMock(key, value) {
  mockStorage.set(key, value);
}

function getMock(key) {
  return mockStorage.get(key);
}

module.exports = {
  createMockUser,
  createMockGuild,
  createMockUserModel,
  createMockInteraction,
  createMockMessage,
  mockDateNow,
  withMockConfig,
  resetMocks,
  setMock,
  getMock,
};

const assert = require('assert');

let testSuite = [];
let currentSuite = null;

function clearTestSuite() {
  testSuite = [];
}

function describe(name, fn) {
  currentSuite = { name, tests: [] };
  testSuite.push(currentSuite);
  fn();
  currentSuite = null;
}

function test(name, fn) {
  if (!currentSuite) {
    throw new Error('test() must be called inside describe()');
  }
  currentSuite.tests.push({ name, fn });
}

function beforeEach(fn) {
  if (!currentSuite) {
    throw new Error('beforeEach() must be called inside describe()');
  }
  if (!currentSuite.beforeEach) {
    currentSuite.beforeEach = fn;
  } else {
    const existing = currentSuite.beforeEach;
    currentSuite.beforeEach = () => {
      existing();
      fn();
    };
  }
}

function afterEach(fn) {
  if (!currentSuite) {
    throw new Error('afterEach() must be called inside describe()');
  }
  if (!currentSuite.afterEach) {
    currentSuite.afterEach = fn;
  } else {
    const existing = currentSuite.afterEach;
    currentSuite.afterEach = () => {
      existing();
      fn();
    };
  }
}

function beforeAll(fn) {
  if (!currentSuite) {
    throw new Error('beforeAll() must be called inside describe()');
  }
  currentSuite.beforeAll = fn;
}

function afterAll(fn) {
  if (!currentSuite) {
    throw new Error('afterAll() must be called inside describe()');
  }
  currentSuite.afterAll = fn;
}

let suiteContext = {};

function runTests() {
  let failed = 0;
  let passed = 0;

  for (const suite of testSuite) {
    console.log(`\n${suite.name}`);

    if (suite.beforeAll) {
      try {
        const result = suite.beforeAll();
        if (result instanceof Promise) {
          throw new Error('beforeAll() cannot return a Promise in this runner');
        }
      } catch (error) {
        console.error(`  FAIL beforeAll: ${error.message}`);
        failed += suite.tests.length;
        continue;
      }
    }

    for (const testCase of suite.tests) {
      suiteContext = {};
      try {
        if (suite.beforeEach) {
          suite.beforeEach();
        }

        const result = testCase.fn();

        if (result instanceof Promise) {
          throw new Error('test() cannot return a Promise in this runner');
        }

        if (suite.afterEach) {
          suite.afterEach();
        }

        console.log(`  PASS ${testCase.name}`);
        passed++;
      } catch (error) {
        console.error(`  FAIL ${testCase.name}`);
        console.error(`        ${error.message}`);
        failed++;
      }
    }

    if (suite.afterAll) {
      try {
        suite.afterAll();
      } catch (error) {
        console.error(`  FAIL afterAll: ${error.message}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = {
  describe,
  test,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  runTests,
  clearTestSuite,
  testSuite,
  suiteContext,
  assert,
};

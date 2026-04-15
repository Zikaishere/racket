const _assert = require('assert');

function assertBetween(actual, min, max, message = '') {
  const msg = message || `Expected ${actual} to be between ${min} and ${max}`;
  if (actual < min || actual > max) {
    throw new Error(msg);
  }
}

function assertArrayContains(array, element, message = '') {
  const msg = message || `Expected array to contain ${element}`;
  if (!array.includes(element)) {
    throw new Error(`${msg}\n  Actual: [${array.join(', ')}]`);
  }
}

function assertArrayNotContains(array, element, message = '') {
  const msg = message || `Expected array to not contain ${element}`;
  if (array.includes(element)) {
    throw new Error(`${msg}\n  Actual: [${array.join(', ')}]`);
  }
}

function assertApproximately(actual, expected, tolerance, message = '') {
  const diff = Math.abs(actual - expected);
  const msg = message || `Expected ${actual} to be within ${tolerance} of ${expected}`;
  if (diff > tolerance) {
    throw new Error(`${msg}\n  Difference: ${diff}`);
  }
}

function assertGreaterThan(actual, expected, message = '') {
  const msg = message || `Expected ${actual} to be greater than ${expected}`;
  if (actual <= expected) {
    throw new Error(msg);
  }
}

function assertLessThan(actual, expected, message = '') {
  const msg = message || `Expected ${actual} to be less than ${expected}`;
  if (actual >= expected) {
    throw new Error(msg);
  }
}

function assertContains(actual, substring, message = '') {
  const msg = message || `Expected "${actual}" to contain "${substring}"`;
  if (!actual.includes(substring)) {
    throw new Error(msg);
  }
}

function assertThrows(fn, message = '') {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw');
  }
}

module.exports = {
  assertBetween,
  assertArrayContains,
  assertArrayNotContains,
  assertApproximately,
  assertGreaterThan,
  assertLessThan,
  assertContains,
  assertThrows,
};

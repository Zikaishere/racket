const { runStartupTests } = require('./startup.test');
const { runConfigTests } = require('./config.test');
const { runCommandRegistryTests } = require('./command-registry.test');
const { runSetupAndBalanceTests } = require('./setup-and-balance.test');
const { runTests: runGameTests, clearTestSuite } = require('./helpers');

console.log('='.repeat(50));
console.log('RACKET TEST SUITE');
console.log('='.repeat(50));

let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${error.message}`);
  }
}

runTest('startup validation', runStartupTests);
runTest('config invariants', runConfigTests);
runTest('setup and balance', runSetupAndBalanceTests);
runTest('command registry', runCommandRegistryTests);

console.log('\n' + '-'.repeat(50));
console.log('GAME LOGIC TESTS');
console.log('-'.repeat(50));

clearTestSuite();
require('./games.test');
const gameResults = runGameTests();
failed += gameResults.failed;

console.log('\n' + '='.repeat(50));
if (failed > 0) {
  console.log(`RESULT: ${failed} test suite(s) failed`);
  process.exit(1);
} else {
  console.log('RESULT: All tests passed!');
}
console.log('='.repeat(50));

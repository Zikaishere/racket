const { runStartupTests } = require('./startup.test');
const { runConfigTests } = require('./config.test');
const { runCommandRegistryTests } = require('./command-registry.test');
const { runSetupAndBalanceTests } = require('./setup-and-balance.test');

const tests = [
  ['startup validation', runStartupTests],
  ['config invariants', runConfigTests],
  ['setup and balance', runSetupAndBalanceTests],
  ['command registry', runCommandRegistryTests],
];

let failed = 0;

for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exit(1);
}

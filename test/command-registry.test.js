const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function getCommandFiles() {
  const commandsRoot = path.join(__dirname, '..', 'src', 'commands');
  const categories = fs.readdirSync(commandsRoot);
  const files = [];

  for (const category of categories) {
    const categoryPath = path.join(commandsRoot, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryPath)) {
      if (file.endsWith('.js')) {
        files.push(path.join(categoryPath, file));
      }
    }
  }

  return files;
}

function runCommandRegistryTests() {
  const files = getCommandFiles();
  assert.ok(files.length > 0, 'expected command files to exist');

  const names = new Set();
  const aliases = new Set();
  const slashNames = new Set();

  for (const file of files) {
    const command = require(file);
    assert.ok(command.name, `missing command name in ${file}`);
    assert.ok(command.description, `missing description in ${file}`);
    assert.ok(command.category, `missing category in ${file}`);
    assert.ok(command.execute || command.executeSlash || command.handleButton || command.handleJoin, `missing executable entry point in ${file}`);

    assert.ok(!names.has(command.name), `duplicate command name: ${command.name}`);
    names.add(command.name);

    for (const alias of command.aliases || []) {
      assert.ok(!names.has(alias), `alias collides with command name: ${alias}`);
      assert.ok(!aliases.has(alias), `duplicate alias: ${alias}`);
      aliases.add(alias);
    }

    if (command.slash) {
      const slashJson = command.slash.toJSON();
      assert.ok(!slashNames.has(slashJson.name), `duplicate slash command: ${slashJson.name}`);
      slashNames.add(slashJson.name);
    }
  }

  assert.ok(names.has('lobby'), 'expected lobby command to be registered');
}

module.exports = { runCommandRegistryTests };
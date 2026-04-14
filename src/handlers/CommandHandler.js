const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');

class CommandHandler {
  constructor(client) {
    this.client = client;
    client.commands = client.commands || new Collection();
    client.aliases = client.aliases || new Collection();
    client.categories = client.categories || new Map();
    client.components = client.components || new Collection(); // For decentralized interaction handling
  }

  load() {
    this.client.commands.clear();
    this.client.aliases.clear();
    this.client.categories.clear();
    this.client.components.clear();

    const commandsPath = path.join(__dirname, '../commands');
    this._readDir(commandsPath);

    console.log(
      `\n📦 Loaded ${this.client.commands.size} commands and ${this.client.components.size} component handlers across ${this.client.categories.size} categories\n`,
    );
  }

  _readDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this._readDir(filePath);
      } else if (file.endsWith('.js')) {
        const command = require(filePath);

        if (!command.name) {
          console.warn(`⚠️  Command at ${filePath} is missing a name, skipping.`);
          continue;
        }

        // Determine category from parent directory name
        const category = path.basename(path.dirname(filePath));
        command.category = category;

        this.client.commands.set(command.name, command);

        if (!command.hidden) {
          if (!this.client.categories.has(category)) {
            this.client.categories.set(category, []);
          }
          this.client.categories.get(category).push(command.name);
        }

        // Prefix aliases
        if (command.aliases) {
          for (const alias of command.aliases) {
            this.client.aliases.set(alias, command.name);
          }
        }

        // Component Registration (Buttons/Menus)
        // If a command exports a 'components' object, we register each key as a prefix
        if (command.components) {
          for (const [customIdPrefix, handler] of Object.entries(command.components)) {
            this.client.components.set(customIdPrefix, handler);
          }
        }

        console.log(`  ✅ Loaded command: ${command.name} [${category}]`);
      }
    }
  }

  async registerSlash() {
    const slashCommands = [];

    for (const [, command] of this.client.commands) {
      if (command.slash) slashCommands.push(command.slash.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(this.client.user.id), { body: slashCommands });
      console.log(`⚡ Registered ${slashCommands.length} slash commands globally`);
    } catch (err) {
      console.error('Failed to register slash commands:', err);
    }
  }
}

module.exports = CommandHandler;

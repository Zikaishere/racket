const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');

class CommandHandler {
  constructor(client) {
    this.client = client;
    client.commands = client.commands || new Collection();   // slash + prefix
    client.aliases  = client.aliases || new Collection();   // prefix aliases
    client.categories = client.categories || new Map();        // category -> command names
  }

  load() {
    const commandsPath = path.join(__dirname, '../commands');
    const categories = fs.readdirSync(commandsPath);

    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);
      if (!fs.statSync(categoryPath).isDirectory()) continue;

      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
      const categoryCommands = [];

      for (const file of files) {
        const command = require(path.join(categoryPath, file));

        // Validate command structure
        if (!command.name) {
          console.warn(`⚠️  Command ${file} is missing a name, skipping.`);
          continue;
        }

        command.category = category;
        this.client.commands.set(command.name, command);
        if (!command.hidden) {
          categoryCommands.push(command.name);
        }

        // Register aliases for prefix commands
        if (command.aliases) {
          for (const alias of command.aliases) {
            this.client.aliases.set(alias, command.name);
          }
        }

        console.log(`  ✅ Loaded command: ${command.name} [${category}]`);
      }

      this.client.categories.set(category, categoryCommands);
    }

    console.log(`\n📦 Loaded ${this.client.commands.size} commands across ${this.client.categories.size} categories\n`);
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

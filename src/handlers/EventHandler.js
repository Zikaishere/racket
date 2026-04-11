const fs = require('fs');
const path = require('path');

class EventHandler {
  constructor(client) {
    this.client = client;
  }

  load() {
    const eventsPath = path.join(__dirname, '../events');
    const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

    for (const file of files) {
      const event = require(path.join(eventsPath, file));

      if (!event.name) {
        console.warn(`⚠️  Event ${file} is missing a name, skipping.`);
        continue;
      }

      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args, this.client));
      } else {
        this.client.on(event.name, (...args) => event.execute(...args, this.client));
      }

      console.log(`  ✅ Loaded event: ${event.name}`);
    }
  }
}

module.exports = EventHandler;

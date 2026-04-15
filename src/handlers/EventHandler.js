const fs = require('fs');
const path = require('path');
const { logError } = require('../utils/errorManager');

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

      const boundExecute = async (...args) => {
        try {
          await event.execute(...args, this.client);
        } catch (error) {
          await logError(error, { event: event.name, file }, this.client);
          console.error(`Error in event ${event.name}:`, error.message);
        }
      };

      if (event.once) {
        this.client.once(event.name, boundExecute);
      } else {
        this.client.on(event.name, boundExecute);
      }

      console.log(`  ✅ Loaded event: ${event.name}`);
    }
  }
}

module.exports = EventHandler;

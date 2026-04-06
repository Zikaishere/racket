const CommandHandler = require('../handlers/CommandHandler');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`\n🎰 Racket is online as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} servers\n`);

    client.user.setPresence({
      activities: [{ name: '.help | Created by difficultyy', type: 0 }],
      status: 'online',
    });

    // Register slash commands now that client is ready
    const handler = new CommandHandler(client);
    await handler.registerSlash();
  }
};
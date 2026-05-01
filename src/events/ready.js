const CommandHandler = require('../handlers/CommandHandler');

function setPresence(client) {
  client.user.setPresence({
    activities: [{ name: '.help | Created by difficultyy', type: 0 }],
    status: 'online',
  });
}

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`\n🎰 Racket is online as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} servers\n`);

    // Set presence immediately
    setPresence(client);

    // Refresh presence every 30 minutes to prevent Discord from clearing it
    setInterval(() => setPresence(client), 30 * 60 * 1000);

    // Register slash commands now that client is ready
    const handler = new CommandHandler(client);
    await handler.registerSlash();
  },
};

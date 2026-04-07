const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');
const os = require('os');

module.exports = {
  name: 'botinfo',
  aliases: ['bi', 'about'],
  description: 'Display information about Racket.',
  usage: '',
  category: 'info',

  slash: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display information about Racket'),

  async execute({ message, client }) {
    return run({ client, reply: (d) => message.reply(d) });
  },

  async executeSlash({ interaction, client }) {
    return run({ client, reply: (d) => interaction.reply(d) });
  }
};

async function run({ client, reply }) {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const mins  = Math.floor((uptime % 3600) / 60);
  const secs  = Math.floor(uptime % 60);

  const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const cpuModel = os.cpus()[0].model;

  const e = embed.info(`🎰 Racket — Bot Info`, null)
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '🤖 Version', value: '1.0.0', inline: true },
      { name: '📡 Servers', value: `${client.guilds.cache.size}`, inline: true },
      { name: '👥 Users', value: `${client.users.cache.size}`, inline: true },
      { name: '⏱️ Uptime', value: `${hours}h ${mins}m ${secs}s`, inline: true },
      { name: '🧠 Memory', value: `${memUsed} MB`, inline: true },
      { name: '⚡ Node.js', value: process.version, inline: true },
      { name: '📦 discord.js', value: `v${require('discord.js').version}`, inline: true },
      { name: '🖥️ CPU', value: cpuModel, inline: false },
      { name: '🔗 Links', value: '[Support Server](https://discord.gg/JfgfGsFeeZ) · [Invite](https://discord.com/oauth2/authorize?client_id=1200858817592840264)', inline: false },
    );

  return reply({ embeds: [e] });
}
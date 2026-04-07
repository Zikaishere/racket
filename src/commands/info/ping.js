const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../utils/embed');

module.exports = {
  name: 'ping',
  aliases: ['latency', 'pong'],
  description: 'Check the bot\'s latency.',
  usage: '',
  category: 'info',

  slash: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),

  async execute({ message, client }) {
    const sent = await message.reply({ embeds: [embed.info('🏓 Pinging...', 'Measuring latency...')] });
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const wsLatency = client.ws.ping;
    return sent.edit({ embeds: [buildEmbed(latency, wsLatency)] });
  },

  async executeSlash({ interaction, client }) {
    await interaction.reply({ embeds: [embed.info('🏓 Pinging...', 'Measuring latency...')] });
    const reply = await interaction.fetchReply();
    const latency = reply.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = client.ws.ping;
    return interaction.editReply({ embeds: [buildEmbed(latency, wsLatency)] });
  }
};

function buildEmbed(latency, wsLatency) {
  const color = latency < 100 ? 0x2DC653 : latency < 200 ? 0xFFB703 : 0xFF6B6B;
  const indicator = latency < 100 ? '🟢' : latency < 200 ? '🟡' : '🔴';
  return require('../../utils/embed').raw(color)
    .setTitle('🏓 Pong!')
    .addFields(
      { name: `${indicator} Message Latency`, value: `${latency}ms`, inline: true },
      { name: '📡 WebSocket', value: `${wsLatency}ms`, inline: true },
    );
}
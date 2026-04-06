const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');

function buildRulesEmbed() {
  return embed.raw(0xA1CF3A)
    .setTitle('Racket | Server Rules')
    .setDescription('Keep this server welcoming, useful, and easy to get help in.')
    .addFields(
      { name: '1. Be respectful', value: 'No harassment, insults, slurs, or hostile behavior.', inline: false },
      { name: '2. Stay on topic', value: 'Use channels for their intended purpose and avoid derailing support conversations.', inline: false },
      { name: '3. No spam', value: 'Do not flood channels, mass ping, self-promote, or post disruptive content.', inline: false },
      { name: '4. Report issues clearly', value: 'When asking for help, include the command used, what happened, and what you expected instead.', inline: false },
      { name: '5. No exploit abuse', value: 'Do not share or attempt malicious abuse, dupes, or bot-breaking behavior.', inline: false },
      { name: '6. Follow staff guidance', value: 'Moderation and support staff decisions should be respected.', inline: false },
    );
}

module.exports = {
  name: 'rules',
  aliases: ['guidelines', 'serverrules'],
  description: 'Post the server rules embed in the current channel.',
  usage: '',
  category: 'info',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Post the server rules embed in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ message }) {
    await message.channel.send({ embeds: [buildRulesEmbed()] });
    return message.reply({ embeds: [embed.success('Rules Posted', `I posted the rules embed in ${message.channel}.`)] });
  },

  async executeSlash({ interaction }) {
    await interaction.channel.send({ embeds: [buildRulesEmbed()] });
    return interaction.reply({ embeds: [embed.success('Rules Posted', `I posted the rules embed in ${interaction.channel}.`)], ephemeral: true });
  },
};

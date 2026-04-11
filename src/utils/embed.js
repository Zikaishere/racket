const { EmbedBuilder } = require('discord.js');
const {
  COLOR_PRIMARY,
  COLOR_SUCCESS,
  COLOR_ERROR,
  COLOR_WARNING,
  COLOR_INFO,
  COLOR_ECONOMY,
  FOOTER,
} = require('../config');

const footer = (embed) => embed.setFooter({ text: FOOTER });

module.exports = {
  primary: (title, desc) => footer(new EmbedBuilder().setColor(COLOR_PRIMARY).setTitle(title).setDescription(desc)),
  success: (title, desc) => footer(new EmbedBuilder().setColor(COLOR_SUCCESS).setTitle(title).setDescription(desc)),
  error: (desc) => footer(new EmbedBuilder().setColor(COLOR_ERROR).setTitle('❌ Error').setDescription(desc)),
  warning: (title, desc) => footer(new EmbedBuilder().setColor(COLOR_WARNING).setTitle(title).setDescription(desc)),
  info: (title, desc) => footer(new EmbedBuilder().setColor(COLOR_INFO).setTitle(title).setDescription(desc)),
  economy: (title, desc) => footer(new EmbedBuilder().setColor(COLOR_ECONOMY).setTitle(title).setDescription(desc)),
  raw: (color) => footer(new EmbedBuilder().setColor(color)),
};

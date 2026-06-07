const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const embed = require('../../utils/embed');
const { DEV_IDS } = require('../../config');
const { DB_WIPE_CONFIRM_PHRASE } = require('../../utils/devDanger');

const OWNER_ID = DEV_IDS[0];

module.exports = {
  name: 'dbwipe',
  aliases: ['deletedb'],
  description: 'Wipe the entire database. Must include the confirmation phrase.',
  usage: `<"${DB_WIPE_CONFIRM_PHRASE}">`,
  category: 'dev',
  devOnly: true,

  slash: new SlashCommandBuilder()
    .setName('dbwipe')
    .setDescription('Wipe the entire database')
    .addStringOption((option) =>
      option
        .setName('confirmation')
        .setDescription(`Type: ${DB_WIPE_CONFIRM_PHRASE}`)
        .setRequired(true),
    ),

  async execute({ message, args }) {
    if (message.author.id !== OWNER_ID) {
      return message.reply({ embeds: [embed.error('Only the primary developer can use this command.')] });
    }

    const input = args.join(' ');
    if (input !== DB_WIPE_CONFIRM_PHRASE) {
      return message.reply({
        embeds: [
          embed.warning(
            'Confirmation Required',
            `To wipe the database, you must run:\n\`rack dbwipe ${DB_WIPE_CONFIRM_PHRASE}\``,
          ),
        ],
      });
    }

    try {
      await mongoose.connection.db.dropDatabase();
      return message.reply({
        embeds: [embed.success('Database Wiped', 'The entire Mongo database was deleted successfully.')],
      });
    } catch (error) {
      return message.reply({ embeds: [embed.error(`Database wipe failed: ${error.message}`)] });
    }
  },

  async executeSlash({ interaction }) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ embeds: [embed.error('Only the primary developer can use this command.')], ephemeral: true });
    }

    const input = interaction.options.getString('confirmation');
    if (input !== DB_WIPE_CONFIRM_PHRASE) {
      return interaction.reply({
        embeds: [
          embed.warning(
            'Confirmation Required',
            `To wipe the database, you must type exactly:\n\`${DB_WIPE_CONFIRM_PHRASE}\``,
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      await mongoose.connection.db.dropDatabase();
      return interaction.reply({
        embeds: [embed.success('Database Wiped', 'The entire Mongo database was deleted successfully.')],
      });
    } catch (error) {
      return interaction.reply({ embeds: [embed.error(`Database wipe failed: ${error.message}`)] });
    }
  },
};
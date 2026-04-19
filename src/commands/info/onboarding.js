const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');

module.exports = {
  name: 'onboarding',
  aliases: ['guide', 'start', 'begin'],
  description: 'A comprehensive guide to getting started with Racket.',
  usage: '',
  category: 'info',
  guildOnly: true,

  slash: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('A comprehensive guide to getting started with Racket'),

  async execute({ message, prefix }) {
    return this.sendGuide(message, prefix);
  },

  async executeSlash({ interaction, guildData }) {
    return this.sendGuide(interaction, guildData?.prefix || '.');
  },

  async sendGuide(ctx, prefix) {
    const isInteraction = !!ctx.reply && !!ctx.options;
    const reply = (data) => isInteraction ? ctx.reply(data) : ctx.reply(data);

    const mainEmbed = embed.raw(0x4361ee)
      .setTitle('🚀 Getting Started with Racket')
      .setDescription(`Welcome to the underworld. Racket is a high-stakes economy and social bot designed for competition and strategy.\n\n**Here is how you survive and thrive:**`)
      .addFields(
        { 
          name: '💵 The Basics', 
          value: `Start by earning your first **Raqs**.\n- \`${prefix}daily\`: Claim your daily bonus.\n- \`${prefix}work\`: Put in some effort for cash.\n- \`${prefix}profile\`: View your stats and progression.`,
          inline: false 
        },
        { 
          name: '🎰 The Casino', 
          value: `Turn your Raqs into Chips at the \`${prefix}cashier\`, then head to the \`${prefix}lobby\`.\n- \`${prefix}blackjack <bet>\`: Test your luck against the house.\n- \`${prefix}slots <bet>\`: High risk, high reward.`,
          inline: false 
        },
        { 
          name: '🏴‍☠️ Heists & Crews', 
          value: `Don't work alone. Join or lead a \`${prefix}crew\` to pull off massive \`${prefix}heist\` jobs.\n- \`${prefix}heist\`: High-stakes multiplayer robberies.`,
          inline: false 
        },
        { 
          name: '💀 Black Market', 
          value: `Find rare items and gear up.\n- \`${prefix}bm-browse\`: See what's for sale.\n- \`${prefix}bm-buy <item>\`: Gear up for your next job.`,
          inline: false 
        }
      )
      .setFooter({ text: `Use ${prefix}help for a full list of commands.` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Help Center')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/racket'), // Placeholder invite
      new ButtonBuilder()
        .setCustomId('onboarding_economy')
        .setLabel('Economy Guide')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('onboarding_casino')
        .setLabel('Casino Guide')
        .setStyle(ButtonStyle.Secondary)
    );

    return reply({ embeds: [mainEmbed], components: [row] });
  }
};

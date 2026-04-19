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
      .setTitle('Getting Started with Racket')
      .setDescription(`Welcome to the underworld. Racket is a high-stakes economy and social bot designed for competition and strategy.\n\n**Here is how you survive and thrive:**`)
    .addFields(
      { 
        name: 'The Basics', 
        value: `Start by earning your first **Raqs**.\n- \`${prefix}daily\`: Claim your daily bonus.\n- \`${prefix}work\`: Put in some effort for cash.\n- \`${prefix}profile\`: View your stats and progression.`,
        inline: false 
      },
      { 
        name: 'The Casino', 
        value: `Turn your Raqs into Chips at the \`${prefix}cashier\`, then head to the \`${prefix}lobby\`.\n- \`${prefix}blackjack <bet>\`: Test your luck against the house.\n- \`${prefix}slots <bet>\`: High risk, high reward.`,
        inline: false 
      },
      { 
        name: 'Heists & Crews', 
        value: `Don't work alone. Join or lead a \`${prefix}crew\` to pull off massive \`${prefix}heist\` jobs.\n- \`${prefix}heist\`: High-stakes multiplayer robberies.`,
        inline: false 
      },
      { 
        name: 'Black Market', 
        value: `Find rare items and gear up.\n- \`${prefix}bm-browse\`: See what's for sale.\n- \`${prefix}bm-buy <item>\`: Gear up for your next job.`,
        inline: false 
      }
    )
      .setFooter({ text: `Use ${prefix}help for a full list of commands.` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Help Center')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/JfgfGsFeeZ'),
      new ButtonBuilder()
        .setCustomId('onboarding_main')
        .setLabel('Main Menu')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('onboarding_economy')
        .setLabel('Economy Guide')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('onboarding_casino')
        .setLabel('Casino Guide')
        .setStyle(ButtonStyle.Primary)
    );

    return reply({ embeds: [mainEmbed], components: [row] });
  },

  components: {
    onboarding_main: async ({ interaction, prefix }) => {
      const e = embed.raw(0x4361ee)
        .setTitle('Getting Started with Racket')
        .setDescription(`Welcome to the underworld. Racket is a high-stakes economy and social bot designed for competition and strategy.\n\n**Here is how you survive and thrive:**`)
        .addFields(
          { 
            name: 'The Basics', 
            value: `Start by earning your first **Raqs**.\n- \`${prefix}daily\`: Claim your daily bonus.\n- \`${prefix}work\`: Put in some effort for cash.\n- \`${prefix}profile\`: View your stats and progression.`,
            inline: false 
          },
          { 
            name: 'The Casino', 
            value: `Turn your Raqs into Chips at the \`${prefix}cashier\`, then head to the \`${prefix}lobby\`.\n- \`${prefix}blackjack <bet>\`: Test your luck against the house.\n- \`${prefix}slots <bet>\`: High risk, high reward.`,
            inline: false 
          },
          { 
            name: 'Heists & Crews', 
            value: `Don't work alone. Join or lead a \`${prefix}crew\` to pull off massive \`${prefix}heist\` jobs.\n- \`${prefix}heist\`: High-stakes multiplayer robberies.`,
            inline: false 
          }
        )
        .setFooter({ text: `Use ${prefix}help for a full list of commands.` });

      return interaction.update({ embeds: [e] });
    },
    onboarding_economy: async ({ interaction, prefix }) => {
      const e = embed.raw(0x2dc653)
        .setTitle('Economy & Progression')
        .setDescription(`Gold is power in this city. Here is how you build your empire.`)
        .addFields(
          { 
            name: 'Raqs vs. Chips', 
            value: `**Raqs** are your primary currency for the streets (heists, items). **Chips** are for the Casino floor.\n- Use \`/cashier buy\` to get chips.`,
            inline: false 
          },
          { 
            name: 'Daily Income', 
            value: `Don't forget to claim your \`/daily\` and go to \`/work\` to keep a steady flow of Raqs coming in.`,
            inline: false 
          },
          { 
            name: 'The Grift', 
            value: `You can \`/rob\` other players, but be careful—if you fail, you might end up with a bounty or in jail.`,
            inline: false 
          }
        )
        .setFooter({ text: 'Racket Economy Guide' });
      
      return interaction.update({ embeds: [e] });
    },
    onboarding_casino: async ({ interaction, prefix }) => {
      const e = embed.raw(0xffb703)
        .setTitle('Casino & Gambling')
        .setDescription(`The house always wins, unless you know what you're doing.`)
        .addFields(
          { 
            name: 'The Lobby', 
            value: `Use \`/lobby\` to enter the interactive casino floor. You can see active tables and your standing.`,
            inline: false 
          },
          { 
            name: 'Ranks & Luck', 
            value: `The more you wager, the higher your Rank. High ranks get access to the **VIP Lounge**.\n- Watch your **Luck**—it fluctuates based on your streaks!`,
            inline: false 
          },
          { 
            name: 'High Stakes', 
            value: `Check out \`/vault\` or \`/roulette\` for big payouts.`,
            inline: false 
          }
        )
        .setFooter({ text: 'Racket Casino Guide' });

      return interaction.update({ embeds: [e] });
    },
    onboarding_start: async ({ interaction, prefix }) => {
      const e = embed.raw(0x4361ee)
        .setTitle('Getting Started with Racket')
        .setDescription(`Welcome to the underworld. Racket is a high-stakes economy and social bot designed for competition and strategy.\n\n**Here is how you survive and thrive:**`)
        .addFields(
          { 
            name: 'The Basics', 
            value: `Start by earning your first **Raqs**.\n- \`${prefix}daily\`: Claim your daily bonus.\n- \`${prefix}work\`: Put in some effort for cash.\n- \`${prefix}profile\`: View your stats and progression.`,
            inline: false 
          },
          { 
            name: 'The Casino', 
            value: `Turn your Raqs into Chips at the \`${prefix}cashier\`, then head to the \`${prefix}lobby\`.\n- \`${prefix}blackjack <bet>\`: Test your luck against the house.\n- \`${prefix}slots <bet>\`: High risk, high reward.`,
            inline: false 
          }
        )
        .setFooter({ text: `Use ${prefix}help for a full list of commands.` });

      return interaction.reply({ embeds: [e], ephemeral: true });
    }
  }
};

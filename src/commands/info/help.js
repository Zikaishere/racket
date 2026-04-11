const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const embed = require('../../utils/embed');
const { DEFAULT_PREFIX, DEV_IDS } = require('../../config');

const CATEGORY_ICONS = {
  economy: '\uD83D\uDCB0',
  casino: '\uD83C\uDFB0',
  heist: '\uD83D\uDD2B',
  blackmarket: '\uD83D\uDD75\uFE0F',
  leaderboard: '\uD83C\uDFC6',
  admin: '\u2699\uFE0F',
  config: '\uD83D\uDEE0\uFE0F',
  info: '\u2139\uFE0F',
};

const CATEGORY_DESCRIPTIONS = {
  economy: 'Earn, spend, and manage your raqs',
  casino: 'Gamble your chips in various games',
  heist: 'Plan and execute heists with a crew',
  blackmarket: 'List and buy items anonymously',
  leaderboard: "See who's on top",
  admin: 'Server admin tools',
  config: 'Server setup and configuration tools',
  info: 'Bot information',
};

function buildMainEmbed(client, prefix) {
  const categories = [...client.categories.entries()].filter(([cat, cmds]) => cat !== 'dev' && cmds.length > 0);
  const totalCommands = categories.reduce((sum, [, cmds]) => sum + cmds.length, 0);

  const e = embed
    .raw(0xe63946)
    .setTitle('\uD83C\uDFB0 Racket - Help')
    .setDescription(
      `Use the menu below to browse commands by category.\nPrefix: \`${prefix}\` � Slash commands also supported.\nTotal commands: **${totalCommands}**\nFor additional help, join the [support server:](https://discord.gg/JfgfGsFeeZ) \n\n**Categories:**`,
    );

  for (const [cat, cmds] of categories) {
    const icon = CATEGORY_ICONS[cat] || '\uD83D\uDCC1';
    const desc = CATEGORY_DESCRIPTIONS[cat] || 'Browse commands in this category';
    e.addFields({
      name: `${icon} ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${cmds.length})`,
      value: desc,
      inline: true,
    });
  }

  return e;
}

function buildCategoryEmbed(client, category, prefix) {
  if (category === 'dev') {
    return embed.error('That category is not available.');
  }

  const commandNames = client.categories.get(category) || [];
  const icon = CATEGORY_ICONS[category] || '\uD83D\uDCC1';

  const e = embed.raw(0xe63946).setTitle(`${icon} ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`);

  const lines = [];
  for (const name of commandNames) {
    const cmd = client.commands.get(name);
    if (!cmd) continue;

    const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map((alias) => `\`${prefix}${alias}\``).join(', ')})` : '';

    lines.push(`**\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ''}\`**${aliases}\n${cmd.description}`);
  }

  e.setDescription(lines.join('\n\n') || 'No commands in this category.');
  return e;
}

function buildSelectMenu(client, currentCategory = null) {
  const options = [...client.categories.entries()]
    .filter(([cat, cmds]) => cat !== 'dev' && cmds.length > 0)
    .map(([cat]) => {
      const icon = CATEGORY_ICONS[cat] || '\uD83D\uDCC1';
      const description = CATEGORY_DESCRIPTIONS[cat] || 'Browse commands in this category';
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${cat.charAt(0).toUpperCase() + cat.slice(1)}`)
        .setValue(cat)
        .setDescription(description)
        .setEmoji(icon.trim())
        .setDefault(cat === currentCategory);
    });

  options.unshift(
    new StringSelectMenuOptionBuilder()
      .setLabel('Overview')
      .setValue('overview')
      .setDescription('Back to main help page')
      .setEmoji('\uD83C\uDFE0')
      .setDefault(currentCategory === null),
  );

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('help_menu').setPlaceholder('Browse a category...').addOptions(options),
  );
}

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Browse all available commands.',
  usage: '[command|category]',
  category: 'info',

  slash: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all available commands')
    .addStringOption((option) =>
      option.setName('command').setDescription('Specific command or category to look up').setRequired(false),
    ),

  async execute({ message, args, client, prefix }) {
    const query = args[0]?.toLowerCase();

    if (query) {
      if (client.categories.has(query)) {
        return message.reply({
          embeds: [buildCategoryEmbed(client, query, prefix)],
          components: [buildSelectMenu(client, query)],
        });
      }

      const cmd = client.commands.get(query) || client.commands.get(client.aliases.get(query));
      if (cmd && !(cmd.category === 'dev' && !DEV_IDS.includes(message.author.id))) {
        const icon = CATEGORY_ICONS[cmd.category] || '\uD83D\uDCC1';
        const e = embed
          .info(`${icon} ${cmd.name}`, cmd.description)
          .addFields(
            { name: 'Usage', value: `\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ''}\``, inline: true },
            { name: 'Category', value: cmd.category, inline: true },
            {
              name: 'Aliases',
              value: cmd.aliases?.length ? cmd.aliases.map((alias) => `\`${alias}\``).join(', ') : 'None',
              inline: true,
            },
          );
        return message.reply({ embeds: [e] });
      }

      return message.reply({ embeds: [embed.error(`No command or category found for \`${query}\`.`)] });
    }

    const msg = await message.reply({
      embeds: [buildMainEmbed(client, prefix)],
      components: [buildSelectMenu(client)],
    });

    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
      }

      const selected = interaction.values[0];
      if (selected === 'overview') {
        await interaction.update({ embeds: [buildMainEmbed(client, prefix)], components: [buildSelectMenu(client)] });
      } else {
        await interaction.update({
          embeds: [buildCategoryEmbed(client, selected, prefix)],
          components: [buildSelectMenu(client, selected)],
        });
      }
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  },

  async executeSlash({ interaction, client }) {
    const guildData = interaction.guildId
      ? await require('../../models/Guild').findOrCreate(interaction.guildId)
      : null;
    const prefix = guildData?.prefix || DEFAULT_PREFIX;
    const query = interaction.options.getString('command')?.toLowerCase();

    if (query) {
      if (client.categories.has(query)) {
        return interaction.reply({
          embeds: [buildCategoryEmbed(client, query, prefix)],
          components: [buildSelectMenu(client, query)],
          ephemeral: true,
        });
      }

      const cmd = client.commands.get(query) || client.commands.get(client.aliases.get(query));
      if (cmd && !(cmd.category === 'dev' && !DEV_IDS.includes(interaction.user.id))) {
        const icon = CATEGORY_ICONS[cmd.category] || '\uD83D\uDCC1';
        const e = embed
          .info(`${icon} ${cmd.name}`, cmd.description)
          .addFields(
            { name: 'Usage', value: `\`${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ''}\``, inline: true },
            { name: 'Category', value: cmd.category, inline: true },
            {
              name: 'Aliases',
              value: cmd.aliases?.length ? cmd.aliases.map((alias) => `\`${alias}\``).join(', ') : 'None',
              inline: true,
            },
          );
        return interaction.reply({ embeds: [e], ephemeral: true });
      }

      return interaction.reply({ embeds: [embed.error(`No command found for \`${query}\`.`)], ephemeral: true });
    }

    const msg = await interaction.reply({
      embeds: [buildMainEmbed(client, prefix)],
      components: [buildSelectMenu(client)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (menuInteraction) => {
      if (menuInteraction.user.id !== interaction.user.id) {
        return menuInteraction.reply({ content: 'This menu is not for you.', ephemeral: true });
      }

      const selected = menuInteraction.values[0];
      if (selected === 'overview') {
        await menuInteraction.update({
          embeds: [buildMainEmbed(client, prefix)],
          components: [buildSelectMenu(client)],
        });
      } else {
        await menuInteraction.update({
          embeds: [buildCategoryEmbed(client, selected, prefix)],
          components: [buildSelectMenu(client, selected)],
        });
      }
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  },
};

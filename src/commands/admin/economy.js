const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../utils/embed');
const { addWallet, removeWallet, addChips, removeChips } = require('../../utils/economy');
const User = require('../../models/User');

module.exports = {
  name: 'economy',
  aliases: ['eco_admin', 'money'],
  description: 'Manage user balances (Admins only).',
  usage: '<give|take|set> <@user> <amount> <raqs|chips|bank>',
  category: 'admin',
  guildOnly: true,
  adminOnly: true,

  slash: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Admin tools for managing user balances')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('Give currency to a user')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true))
        .addNumberOption((opt) => opt.setName('amount').setDescription('Amount to give').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Currency type')
            .setRequired(true)
            .addChoices(
              { name: 'Raqs', value: 'raqs' },
              { name: 'Chips', value: 'chips' },
              { name: 'Bank', value: 'bank' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('take')
        .setDescription('Remove currency from a user')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true))
        .addNumberOption((opt) => opt.setName('amount').setDescription('Amount to remove').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Currency type')
            .setRequired(true)
            .addChoices(
              { name: 'Raqs', value: 'raqs' },
              { name: 'Chips', value: 'chips' },
              { name: 'Bank', value: 'bank' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set exact currency for a user')
        .addUserOption((opt) => opt.setName('target').setDescription('The user').setRequired(true))
        .addNumberOption((opt) => opt.setName('amount').setDescription('Target amount').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Currency type')
            .setRequired(true)
            .addChoices(
              { name: 'Raqs', value: 'raqs' },
              { name: 'Chips', value: 'chips' },
              { name: 'Bank', value: 'bank' },
            ),
        ),
    ),

  async execute({ message, args }) {
    if (args.length < 4)
      return message.reply({
        embeds: [embed.error('Usage: `.economy <give|take|set> <@user> <amount> <raqs|chips|bank>`')],
      });
    const sub = args[0].toLowerCase();
    const target = message.mentions.users.first() || (await message.client.users.fetch(args[1]).catch(() => null));
    const amount = Number(args[2]);
    const type = args[3].toLowerCase();

    if (!target) return message.reply({ embeds: [embed.error('User not found.')] });
    if (isNaN(amount) || amount < 0)
      return message.reply({ embeds: [embed.error('Amount must be a positive number.')] });
    if (!['raqs', 'chips', 'bank'].includes(type))
      return message.reply({ embeds: [embed.error('Invalid currency type.')] });

    return this.processAction(message, target.id, sub, amount, type, message.guild.id);
  },

  async executeSlash({ interaction }) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('target');
    const amount = interaction.options.getNumber('amount');
    const type = interaction.options.getString('type');

    if (amount < 0)
      return interaction.reply({ embeds: [embed.error('Amount down must be a positive number.')], ephemeral: true });
    return this.processAction(interaction, target.id, sub, amount, type, interaction.guild.id);
  },

  async processAction(ctx, targetId, action, amount, type, guildId) {
    const isInteraction = !!ctx.options;
    const reply = (c) => (isInteraction ? ctx.reply({ embeds: [c], ephemeral: true }) : ctx.reply({ embeds: [c] }));

    if (action === 'give') {
      if (type === 'raqs') await addWallet(targetId, guildId, amount);
      if (type === 'chips') await addChips(targetId, guildId, amount);
      if (type === 'bank')
        await User.findOneAndUpdate({ userId: targetId, guildId }, { $inc: { bank: amount } }, { upsert: true });
      return reply(
        embed.success(
          'Economy Adjusted',
          `Successfully added **${amount.toLocaleString()} ${type}** to <@${targetId}>.`,
        ),
      );
    }

    if (action === 'take') {
      if (type === 'raqs') await removeWallet(targetId, guildId, amount);
      if (type === 'chips') await removeChips(targetId, guildId, amount);
      if (type === 'bank')
        await User.findOneAndUpdate({ userId: targetId, guildId, bank: { $gte: amount } }, { $inc: { bank: -amount } });
      return reply(
        embed.success(
          'Economy Adjusted',
          `Successfully removed **${amount.toLocaleString()} ${type}** from <@${targetId}>.`,
        ),
      );
    }

    if (action === 'set') {
      let updateDoc = {};
      if (type === 'raqs') updateDoc = { wallet: amount, balance: amount };
      if (type === 'chips') updateDoc = { chips: amount };
      if (type === 'bank') updateDoc = { bank: amount };

      await User.findOneAndUpdate(
        { userId: targetId, guildId },
        { $set: updateDoc },
        { upsert: true, setDefaultsOnInsert: true },
      );
      return reply(
        embed.success(
          'Economy Adjusted',
          `Successfully set <@${targetId}>'s ${type} to **${amount.toLocaleString()}**.`,
        ),
      );
    }
  },
};

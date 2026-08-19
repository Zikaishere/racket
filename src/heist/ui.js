const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../utils/embed');
const { fmt } = require('../utils/economy');
const { STRATEGIES, ROLES } = require('./gameData');

const HEIST_COLOR = 0xe63946;
const SUCCESS_COLOR = 0x2dc653;
const FAIL_COLOR = 0xff6b6b;

function buildPlanningEmbed(heist) {
  const strategy = STRATEGIES[heist.strategy];
  const entry = heist.entryOptions[heist.selectedEntryIndex];
  const secondsLeft = Math.max(1, Math.ceil((heist.launchAt - Date.now()) / 1000));
  const target = heist.target;

  const crewLines = [...heist.crew.entries()]
    .map(([id, m]) => {
      const roleData = ROLES[m.role] || {};
      return `${roleData.emoji || '👤'} <@${id}> — **${m.role}**${m.crewName ? ` (${m.crewName})` : ''}`;
    })
    .join('\n');

  return embed
    .raw(HEIST_COLOR)
    .setTitle(`${target.emoji} Heist Planning`)
    .setDescription(`**${target.name}** · ${fmt(heist.bet)} bet · ${heist.crew.size}/${target.maxCrew} crew`)
    .addFields(
      {
        name: 'Plan',
        value: `${strategy.emoji} ${strategy.label} · ${entry.emoji} ${entry.name}${heist.scoped ? ' · 🔍 Scoped' : ''}`,
        inline: false,
      },
      {
        name: `Crew (${heist.crew.size}/${target.maxCrew})`,
        value: crewLines || 'Waiting for crew...',
        inline: false,
      },
    )
    .setFooter({ text: `${secondsLeft}s remaining · Base success: ~${Math.round(target.successRate * 100)}%` });
}

function buildControls(heist, disabled = false) {
  const strategyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('heist_strategy')
      .setLabel(`Strategy: ${STRATEGIES[heist.strategy].label}`)
      .setEmoji(STRATEGIES[heist.strategy].emoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('heist_entry')
      .setLabel(`Entry: ${heist.entryOptions[heist.selectedEntryIndex].name}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('heist_join')
      .setLabel('Join Crew')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('heist_scope')
      .setLabel(heist.scoped ? 'Scoped ✓' : 'Scope +15s')
      .setStyle(heist.scoped ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(disabled || heist.scoped),
    new ButtonBuilder()
      .setCustomId('heist_launch')
      .setLabel('Launch')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );

  return [strategyRow, actionRow];
}

function formatModifiers(heist, strategy, entry, roleBonuses, scoped) {
  const parts = [];
  parts.push(`Base: ${Math.round(heist.target.successRate * 100)}%`);
  if (strategy.successMod !== 0) {
    parts.push(`Strategy: ${strategy.successMod > 0 ? '+' : ''}${Math.round(strategy.successMod * 100)}%`);
  }
  if (entry.successMod !== 0) {
    parts.push(`Entry: ${entry.successMod > 0 ? '+' : ''}${Math.round(entry.successMod * 100)}%`);
  }
  if (roleBonuses.successBonus > 0.08) {
    parts.push(`Roles: +${Math.round((roleBonuses.successBonus - 0.08) * 100)}%`);
  }
  if (scoped) parts.push('Scope: +5%');
  if (roleBonuses.crewSynergyBonus > 0) {
    parts.push(`Crew: +${Math.round(roleBonuses.crewSynergyBonus * 100)}%`);
  }
  return parts.join(' → ');
}

function buildSuccessEmbed(result) {
  const { heist, strategy, entry, roleBonuses, successChance, outcome, payouts } = result;

  const payoutLines = payouts.map((p) => {
    const roleData = ROLES[p.role] || {};
    return `${roleData.emoji || '👤'} <@${p.memberId}> — **${p.role}** → ${fmt(p.payout)}`;
  });

  return embed
    .raw(SUCCESS_COLOR)
    .setTitle(`${heist.target.emoji} Heist Successful`)
    .setDescription(`*"${outcome}"*`)
    .addFields(
      { name: 'Crew', value: payoutLines.join('\n'), inline: false },
      {
        name: 'Modifiers',
        value: formatModifiers(heist, strategy, entry, roleBonuses, heist.scoped),
        inline: false,
      },
      {
        name: 'Final Success',
        value: `**${Math.round(successChance * 100)}%**`,
        inline: true,
      },
      {
        name: 'Strategy',
        value: `${strategy.emoji} ${strategy.label}`,
        inline: true,
      },
      {
        name: 'Entry',
        value: `${entry.emoji} ${entry.name}`,
        inline: true,
      },
    )
    .setFooter({ text: entry.reveal });
}

function buildFailureEmbed(result) {
  const { heist, strategy, entry, roleBonuses, successChance, outcome, heat, penalties } = result;

  const penaltyLines = penalties.map((p) => {
    const roleData = ROLES[p.role] || {};
    const parts = [`${roleData.emoji || '👤'} <@${p.memberId}> — **${p.role}**`];
    if (p.escaped) {
      parts.push('✅ Escaped');
    } else {
      if (p.seizure > 0) parts.push(`Seized ${fmt(p.seizure)}`);
      if (p.extraLoss > 0) parts.push(`Extra loss ${fmt(p.extraLoss)}`);
      if (p.cooldownMs > 0) parts.push(`${Math.round(p.cooldownMs / 60000)}m cooldown`);
      if (p.wantedApplied) parts.push('Wanted 24h');
    }
    return parts.join(' · ');
  });

  return embed
    .raw(FAIL_COLOR)
    .setTitle(`${heist.target.emoji} Heist Failed`)
    .setDescription(`*"${outcome}"*\n\n${strategy.failText}`)
    .addFields(
      { name: 'Crew', value: penaltyLines.join('\n'), inline: false },
      {
        name: 'Police Response',
        value: `${heat.emoji} **${heat.name}** — ${heat.description}`,
        inline: false,
      },
      {
        name: 'Modifiers',
        value: formatModifiers(heist, strategy, entry, roleBonuses, heist.scoped),
        inline: false,
      },
      {
        name: 'Final Success',
        value: `**${Math.round(successChance * 100)}%**`,
        inline: true,
      },
      {
        name: 'Strategy',
        value: `${strategy.emoji} ${strategy.label}`,
        inline: true,
      },
      {
        name: 'Entry',
        value: `${entry.emoji} ${entry.name}`,
        inline: true,
      },
    );
}

function buildCancelledEmbed(heist) {
  const minPlayers = Math.max(2, heist.target.minCrew);
  return embed
    .warning(
      'Heist Cancelled',
      `Not enough crew joined. Needed at least ${minPlayers} for **${heist.target.name}**.`,
    )
    .addFields({
      name: 'Crew',
      value: [...heist.crew.entries()].map(([id]) => `<@${id}>`).join(', ') || 'Nobody held their nerve.',
    });
}

module.exports = {
  HEIST_COLOR,
  SUCCESS_COLOR,
  FAIL_COLOR,
  buildPlanningEmbed,
  buildControls,
  buildSuccessEmbed,
  buildFailureEmbed,
  buildCancelledEmbed,
  formatModifiers,
};

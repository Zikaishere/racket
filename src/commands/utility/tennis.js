const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../utils/embed');

const activeMatches = new Map();

const SHOTS = {
  flat: { name: 'Flat', emoji: '🔨', beats: ['slice'], losesTo: ['topspin'] },
  topspin: { name: 'Topspin', emoji: '🌀', beats: ['flat'], losesTo: ['slice'] },
  slice: { name: 'Slice', emoji: '🔪', beats: ['topspin'], losesTo: ['flat'] },
  lob: { name: 'Lob', emoji: '🎯', beats: ['drop'], losesTo: ['flat', 'topspin'] },
  drop: { name: 'Drop Shot', emoji: '🪤', beats: ['flat', 'topspin'], losesTo: ['slice', 'lob'] },
};

const SHOT_KEYS = Object.keys(SHOTS);
const POINTS_TO_WIN = 4;

function generateId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function resolvePoint(serverShot, returnShot) {
  const s = SHOTS[serverShot];
  const r = SHOTS[returnShot];

  if (serverShot === returnShot) return { winner: null, text: 'Both players chose the same shot — rally continues!' };

  if (s.beats.includes(returnShot)) return { winner: 'server', text: `${s.emoji} ${s.name} overpowers ${r.emoji} ${r.name}!` };
  if (r.beats.includes(serverShot)) return { winner: 'returner', text: `${r.emoji} ${r.name} counters ${s.emoji} ${s.name}!` };

  // lob vs flat/topspin = returner wins, but flat/topspin vs lob = server wins (already handled by beats)
  // fallback: random with slight server advantage
  return { winner: Math.random() < 0.55 ? 'server' : 'returner', text: 'A close exchange — edge to the returner!' };
}

function matchStatus(match) {
  const { p1, p2 } = match.scores;
  const diff = Math.abs(p1 - p2);
  const total = p1 + p2;

  if (p1 >= POINTS_TO_WIN && diff >= 2) return 'p1_wins';
  if (p2 >= POINTS_TO_WIN && diff >= 2) return 'p2_wins';
  if (total >= 6 && diff <= 1) return 'deuce';
  return 'playing';
}

function buildLobbyEmbed(match) {
  const p1 = match.players[0];
  const p2 = match.players[1];

  return embed
    .raw(0x2dc653)
    .setTitle('🎾 Tennis Match')
    .setDescription(
      `**${p1.username}** vs **${p2 ? p2.username : 'Waiting for opponent...'}**\n\nFirst to ${POINTS_TO_WIN} points (win by 2).`,
    )
    .setFooter({ text: p2 ? 'Both players click Ready to begin.' : 'Another player can join with the button below.' });
}

function buildLobbyButtons(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tennis_join_${matchId}`).setLabel('Join Match').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`tennis_ready_${matchId}`).setLabel('Ready').setStyle(ButtonStyle.Primary),
  );
}

function buildShotButtons(matchId) {
  return new ActionRowBuilder().addComponents(
    ...SHOT_KEYS.map((key) =>
      new ButtonBuilder()
        .setCustomId(`tennis_shot_${matchId}_${key}`)
        .setLabel(`${SHOTS[key].emoji} ${SHOTS[key].name}`)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

function buildMatchEmbed(match, pointResult) {
  const p1 = match.players[0];
  const p2 = match.players[1];
  const { p1: s1, p2: s2 } = match.scores;
  const status = matchStatus(match);
  const isDeuce = status === 'deuce';

  const server = match.players[match.serverIndex];
  const returner = match.players[1 - match.serverIndex];

  let description = `**${p1.username}** ${s1} - ${s2} **${p2.username}**`;
  if (isDeuce) description += '\n⚡ Deuce — must win by 2!';
  if (status === 'p1_wins') description = `🏆 **${p1.username}** wins the match!`;
  if (status === 'p2_wins') description = `🏆 **${p2.username}** wins the match!`;

  const color = status.includes('wins') ? 0xffd700 : 0x457b9d;

  const e = embed.raw(color).setTitle('🎾 Tennis Match').setDescription(description);

  if (pointResult) {
    e.addFields({ name: 'Last Point', value: pointResult, inline: false });
  }

  if (status === 'playing') {
    e.addFields({
      name: 'Current Point',
      value: `Serving: ${server.username} — Returning: ${returner.username}`,
      inline: false,
    });
  }

  return e;
}

function buildShotPrompt(match, shooter) {
  return embed
    .raw(0xffb703)
    .setTitle('🎾 Your Shot')
    .setDescription(`<@${shooter.id}>, pick your shot!`);
}

const run = async ({ userId, guildId, username, reply }) => {
  const matchId = generateId();
  const match = {
    id: matchId,
    guildId,
    hostId: userId,
    players: [{ id: userId, username, ready: false }],
    status: 'lobby',
    scores: { p1: 0, p2: 0 },
    serverIndex: 0,
    pointLog: [],
    message: null,
  };

  activeMatches.set(matchId, match);
  const message = await reply({ embeds: [buildLobbyEmbed(match)], components: [buildLobbyButtons(matchId)] });
  match.message = message;
};

module.exports = {
  name: 'tennis',
  aliases: ['match'],
  description: 'Challenge someone to a tennis match. No rewards, just bragging rights.',
  usage: '',
  category: 'utility',
  guildOnly: true,

  slash: new SlashCommandBuilder().setName('tennis').setDescription('Start a tennis match (no bet, just fun)'),

  async execute({ message }) {
    return run({
      userId: message.author.id,
      guildId: message.guild.id,
      username: message.author.username,
      reply: (data) => message.reply(data),
    });
  },

  async executeSlash({ interaction }) {
    return run({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      username: interaction.user.username,
      reply: (data) => interaction.reply(data),
    });
  },

  components: {
    tennis: async ({ interaction }) => {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const matchId = parts[2];
      const shot = parts[3];
      const match = activeMatches.get(matchId);

      if (!match) return interaction.reply({ embeds: [embed.error('This match has ended or expired.')], ephemeral: true });

      const userId = interaction.user.id;

      // ── JOIN ────────────────────────────────────────────
      if (action === 'join') {
        if (match.status !== 'lobby') return interaction.reply({ embeds: [embed.error('Match already started.')], ephemeral: true });
        if (match.players.length >= 2) return interaction.reply({ embeds: [embed.error('Match is full.')], ephemeral: true });
        if (match.players.some((p) => p.id === userId)) return interaction.reply({ embeds: [embed.error('You are already in this match.')], ephemeral: true });

        match.players.push({ id: userId, username: interaction.user.username, ready: false });
        return interaction.update({ embeds: [buildLobbyEmbed(match)], components: [buildLobbyButtons(matchId)] });
      }

      // ── READY ───────────────────────────────────────────
      if (action === 'ready') {
        const player = match.players.find((p) => p.id === userId);
        if (!player) return interaction.reply({ embeds: [embed.error('You are not in this match.')], ephemeral: true });
        if (match.players.length < 2) return interaction.reply({ embeds: [embed.error('Need 2 players to start.')], ephemeral: true });

        player.ready = true;

        if (match.players.every((p) => p.ready)) {
          match.status = 'playing';
          match.serverIndex = 0;
          const server = match.players[match.serverIndex];
          const returner = match.players[1 - match.serverIndex];

          const matchEmbed = buildMatchEmbed(match);
          matchEmbed.addFields({
            name: 'Current Point',
            value: `Serving: **${server.username}** — Returning: **${returner.username}**`,
          });

          await interaction.update({ embeds: [matchEmbed], components: [] });
          return match.message.edit({
            embeds: [buildShotPrompt(match, server)],
            components: [buildShotButtons(matchId)],
          });
        }

        return interaction.update({ embeds: [buildLobbyEmbed(match)], components: [buildLobbyButtons(matchId)] });
      }

      // ── SHOT ────────────────────────────────────────────
      if (action === 'shot') {
        if (match.status !== 'playing') return interaction.reply({ embeds: [embed.error('Match is not active.')], ephemeral: true });

        const server = match.players[match.serverIndex];
        const returner = match.players[1 - match.serverIndex];

        if (userId === server.id) {
          // Server picking — store and prompt returner
          if (match._pendingServerShot) return interaction.reply({ embeds: [embed.error('You already picked your shot.')], ephemeral: true });
          match._pendingServerShot = shot;

          await interaction.reply({ embeds: [embed.success('Shot Selected', `${SHOTS[shot].emoji} **${SHOTS[shot].name}** locked in. Waiting for returner...`)], ephemeral: true });
          return match.message.edit({
            embeds: [buildShotPrompt(match, returner)],
            components: [buildShotButtons(matchId)],
          });
        }

        if (userId === returner.id) {
          if (!match._pendingServerShot) return interaction.reply({ embeds: [embed.error('Server has not picked yet.')], ephemeral: true });

          const serverShot = match._pendingServerShot;
          match._pendingServerShot = null;

          const result = resolvePoint(serverShot, shot);
          let pointWinner;
          if (result.winner === 'server') {
            pointWinner = server;
            match.scores.p1 += match.serverIndex === 0 ? 1 : 0;
            match.scores.p2 += match.serverIndex === 1 ? 1 : 0;
          } else if (result.winner === 'returner') {
            pointWinner = returner;
            match.scores.p1 += match.serverIndex === 1 ? 1 : 0;
            match.scores.p2 += match.serverIndex === 0 ? 1 : 0;
          } else {
            // Tie — replay the point
            await interaction.reply({ embeds: [embed.info('Rally!', result.text)], ephemeral: true });
            return match.message.edit({
              embeds: [buildShotPrompt(match, server)],
              components: [buildShotButtons(matchId)],
            });
          }

          const pointText = `${SHOTS[serverShot].emoji} ${server.username} vs ${SHOTS[shot].emoji} ${returner.username}\n${result.text}\n**Point: ${pointWinner.username}**`;
          match.pointLog.push(pointText);

          const status = matchStatus(match);
          if (status.includes('wins')) {
            match.status = 'done';
            activeMatches.delete(matchId);
            const finalEmbed = buildMatchEmbed(match, pointText);
            return interaction.update({ embeds: [finalEmbed], components: [] });
          }

          // Next point — alternate server
          match.serverIndex = 1 - match.serverIndex;
          const nextServer = match.players[match.serverIndex];

          const matchEmbed = buildMatchEmbed(match, pointText);
          await interaction.update({ embeds: [matchEmbed], components: [] });
          return match.message.edit({
            embeds: [buildShotPrompt(match, nextServer)],
            components: [buildShotButtons(matchId)],
          });
        }

        return interaction.reply({ embeds: [embed.error('It is not your turn.')], ephemeral: true });
      }
    },
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Show top users by progress points'),
  async execute(interaction) {
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply(); } catch (e) { console.warn('deferReply failed (leaderboard):', e && e.message); }
    const data = await readData();
    const users = Object.entries(data.users || {}).map(([id, u]) => ({ id, pts: u.progressPoints || 0 }));
    users.sort((a, b) => b.pts - a.pts);
    const top = users.slice(0, 5);
    const lines = top.map((u, i) => {
      if (i === 0) return `🥇 1. <@${u.id}> — ${u.pts} pts`;
      if (i === 1) return `🥈 2. <@${u.id}> — ${u.pts} pts`;
      if (i === 2) return `🥉 3. <@${u.id}> — ${u.pts} pts`;
      return `${i + 1}. <@${u.id}> — ${u.pts} pts`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Leaderboard')
      .setDescription(lines.join('\n') || 'No users yet')
      .setColor(0xFFD700)
      .setFooter({ text: 'Keep grinding 🔥' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

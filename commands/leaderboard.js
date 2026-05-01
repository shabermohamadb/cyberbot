const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Show top users by progress points'),
  async execute(interaction) {
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply(); } catch (e) { console.warn('deferReply failed (leaderboard):', e && e.message); }
    const data = await readData();
    const users = Object.entries(data.users || {}).map(([id, u]) => ({ id, pts: u.progressPoints || 0 }));
    users.sort((a, b) => b.pts - a.pts);
    const embed = new EmbedBuilder().setTitle('Leaderboard').setColor(0xFFD700);
    for (let i = 0; i < Math.min(10, users.length); i++) {
      embed.addFields({ name: `#${i + 1}`, value: `<@${users[i].id}> — ${users[i].pts} pts` });
    }
    await interaction.editReply({ embeds: [embed] });
  }
};

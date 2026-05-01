const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetpoints')
    .setDescription('Reset progress and quest points for all users (admin only)'),
  async execute(interaction) {
    // Admin only
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (e) {}

    const data = await readData();
    const users = data.users || {};
    let changed = 0;
    for (const uid of Object.keys(users)) {
      const u = users[uid] || {};
      if ((u.progressPoints || 0) !== 0 || (u.questPoints || 0) !== 0 || (u.progressStrikes || 0) !== 0 || (u.quizStrikes || 0) !== 0) changed++;
      u.progressPoints = 0;
      u.questPoints = 0;
      u.progressStrikes = 0;
      u.quizStrikes = 0;
      u.streak = 0;
      u.quizStreak = 0;
      users[uid] = u;
    }
    data.users = users;
    await writeData(data);

    const embed = new EmbedBuilder()
      .setTitle('🧾 Data Reset')
      .setDescription(`Reset points and strikes for **${changed}** users.`)
      .setColor(0xFF0000)
      .setTimestamp();

    try { await interaction.editReply({ embeds: [embed] }); } catch (e) { await interaction.followUp({ content: 'Reset complete.', ephemeral: true }); }
  }
};

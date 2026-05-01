const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder().setName('points').setDescription('Show your points and progress'),
  async execute(interaction) {
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }); } catch (e) { console.warn('deferReply failed (points):', e && e.message); }
    const data = await readData();
    const u = data.users && data.users[interaction.user.id];
    if (!u) return interaction.editReply('No data for you yet. Post progress to get started.');
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${interaction.user.username}'s Stats`)
      .setColor(0x6A5ACD)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '🏆 Progress Points', value: `**${u.progressPoints || 0}**`, inline: true },
        { name: '🎯 Quest Points', value: `**${u.questPoints || 0}**`, inline: true },
        { name: '⚠️ Progress Strikes', value: `**${u.progressStrikes || 0}**`, inline: true },
        { name: '❌ Quiz Strikes', value: `**${u.quizStrikes || 0}**`, inline: true },
        { name: '🔥 Streak', value: `**${u.streak || 0} days**`, inline: true }
      )
      .setFooter({ text: 'Keep learning — small steps every day!' });
    await interaction.editReply({ embeds: [embed] });
  }
};

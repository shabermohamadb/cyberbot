const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/dataStore');
const { getActiveQuiz } = require('../utils/quizManager');

module.exports = {
  data: new SlashCommandBuilder().setName('quest').setDescription('Show current quest / quiz status for this server'),
  async execute(interaction) {
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }); } catch (e) { console.warn('deferReply failed (quest):', e && e.message); }
    const data = await readData();
    const guildCfg = data.guilds && data.guilds[interaction.guildId];
    const embed = new EmbedBuilder().setTitle('Quest Status').setColor(0x0099ff);
    if (guildCfg && guildCfg.questChannel) embed.addFields({ name: 'Quest Channel', value: `<#${guildCfg.questChannel}>` });

    const active = getActiveQuiz();
    if (active && active.message && String(active.message.channelId) === String(interaction.channelId)) {
      const elapsed = Math.floor((Date.now() - active.startedAt) / 1000);
      const remaining = Math.max(0, (active.seconds || 30) - elapsed);
      embed.addFields({ name: 'Active Quiz', value: active.question.question || 'Question in progress' });
      embed.addFields({ name: 'Time left', value: `${remaining}s`, inline: true });
    } else if (active) {
      embed.addFields({ name: 'Active Quiz', value: `Quiz running in <#${active.message.channelId}>. Use /join there to participate.` });
    } else {
      embed.addFields({ name: 'Active Quiz', value: 'No active quiz currently. Use /quize to start one.' });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

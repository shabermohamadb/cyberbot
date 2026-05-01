const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { readData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendnow')
    .setDescription('Force-send a scheduled message now (admin only)')
    .addStringOption(o => o.setName('type').setDescription('quote|info|learn').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }
    const type = interaction.options.getString('type');
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const data = await readData();
    const g = data.guilds && data.guilds[interaction.guild.id];
    if (!g) return interaction.editReply('No guild configuration found.');

    try {
      if (type === 'quote') {
        const chId = g.quoteSchedule && g.quoteSchedule.channelId;
        if (!chId) return interaction.editReply('No quote channel configured.');
        const ch = await interaction.client.channels.fetch(chId).catch(() => null);
        if (!ch) return interaction.editReply('Cannot fetch quote channel.');
        const QUOTES = [
          "Small steps every day lead to big results.",
          "Consistency beats intensity — keep showing up.",
          "Learn a little, improve a lot. You've got this!",
          "Today +1% better than yesterday. Keep going.",
          "Progress is progress — celebrate small wins."
        ];
        const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        const embed = { title: '🌅 Daily Motivation', description: `💬 ${q}`, footer: { text: 'Stay consistent 🔥' }, timestamp: new Date() };
        await ch.send({ embeds: [embed] });
        return interaction.editReply('Quote sent.');
      }
      if (type === 'info') {
        const chId = g.infoSchedule && g.infoSchedule.channelId;
        if (!chId) return interaction.editReply('No info channel configured.');
        const ch = await interaction.client.channels.fetch(chId).catch(() => null);
        if (!ch) return interaction.editReply('Cannot fetch info channel.');
        const TECH_INFO = [
          "Coding: Keep functions small and focused — one responsibility per function improves readability.",
          "Coding: Write tests for edge cases and use linting to keep code consistent.",
          "Data Structure: Use hash maps for fast key-value lookups (O(1)) when order isn't required.",
          "Algorithms: Learn sorting algorithms (quick/merge) and when to use them based on stability and average-case performance.",
          "Security: Keep dependencies up-to-date and run vulnerability scans regularly.",
          "Security: Never commit secrets — use environment variables or a secrets manager.",
          "News: Follow major open-source releases and RFCs to stay current with platform changes.",
          "Career: Build a portfolio project that demonstrates end-to-end thinking (frontend, backend, tests, docs).",
          "Study Habit: Break learning into 25-minute focused sessions (Pomodoro) and review notes afterward."
        ];
        const info = TECH_INFO[Math.floor(Math.random() * TECH_INFO.length)];
        const embed = { title: '📘 Daily Tech Info', description: `${info}`, footer: { text: 'Useful for students — learn daily' }, timestamp: new Date() };
        await ch.send({ embeds: [embed] });
        return interaction.editReply('Information sent.');
      }
      if (type === 'learn') {
        const announceId = g.vcReminder && g.vcReminder.announceChannelId ? g.vcReminder.announceChannelId : null;
        const targetChId = announceId || g.progressChannel || g.questChannel;
        if (!targetChId) return interaction.editReply('No target channel configured for daily learning.');
        const ch = await interaction.client.channels.fetch(targetChId).catch(() => null);
        if (!ch) return interaction.editReply('Cannot fetch target channel.');
        const vcMention = g.vcReminder && g.vcReminder.channelId ? `<#${g.vcReminder.channelId}>` : '';
        const embed = {
          title: '🔥 DAILY LEARNING TIME! ',
          description: `⏰ Time: ${g.dailyLearnTime || 'now'}\n🎧 Join VC: ${vcMention}\n📚 Duration: 10 Minutes\n\n💡 "Just 10 minutes daily can change your future."`,
          footer: { text: 'Let\'s grow together!' },
          timestamp: new Date()
        };
        await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
        return interaction.editReply('Daily learning announcement sent.');
      }
      return interaction.editReply('Unknown type. Use quote|info|learn');
    } catch (e) {
      console.error('sendnow failed', e);
      return interaction.editReply('Send failed.');
    }
  }
};

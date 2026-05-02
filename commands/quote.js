const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Schedule or send a daily motivation quote')
    .addStringOption(o => o.setName('time').setDescription('HH:MM (24h) e.g. 08:00').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Text channel to post quote in').setRequired(false))
    .addBooleanOption(o => o.setName('now').setDescription('Send the quote now (ignore scheduling)')),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }
    const time = interaction.options.getString('time');
    const channel = interaction.options.getChannel('channel');
    const nowSend = interaction.options.getBoolean('now');
    try { await interaction.deferReply({ ephemeral: true }); } catch (e) {}
    // If user requested immediate send
    if (nowSend) {
      // determine channel
      let target = channel || interaction.channel;
      if (!target) return interaction.editReply('Cannot determine target channel to send quote.');
      const { readData, updateGuild } = require('../utils/dataStore');
      const data = await readData();
      const g = data.guilds && data.guilds[interaction.guild.id];
      const lastIndex = g && g.lastQuoteIndex;
      const QUOTES = [
        "Success comes from consistency.",
        "Small steps daily lead to big success.",
        "Discipline beats motivation.",
        "Consistency is the key to success.",
        "Keep showing up — progress compounds over time."
      ];
      const pickIndex = Math.floor(Math.random() * QUOTES.length);
      let idx = pickIndex;
      if (QUOTES.length > 1 && idx === lastIndex) idx = (idx + 1) % QUOTES.length;
      const q = QUOTES[idx];
      const todayKey = new Date().toISOString().slice(0,10);
      const embed = new EmbedBuilder()
        .setTitle('💡 Daily Motivation')
        .setColor(0x0099FF)
        .setDescription(['💬 **Hey everyone! Hope you\'re doing great 😊**', '', '📌 Stay consistent with your daily learning!', '', '💡 **Today\'s Motivation:**', `"${q}"`, '', '🔥 Keep pushing — you\'re improving!'].join('\n'))
        .setFooter({ text: 'Stay consistent 🔥' })
        .setTimestamp();
      await target.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
      await updateGuild(interaction.guild.id, { lastQuoteDate: todayKey, lastQuoteIndex: idx });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x0099FF).setDescription('Quote sent.')] });
    }

    // scheduling mode
    if (!time || !channel) return interaction.editReply('To schedule a quote, provide both `time` and `channel`.');
    await updateGuild(interaction.guild.id, { quoteSchedule: { time, channelId: channel.id } });

    const embed = new EmbedBuilder()
      .setTitle('✅ Quote Scheduled')
      .setDescription(`Daily motivation set at **${time}** in <#${channel.id}>`)
      .setColor(0x0099FF)
      .setTimestamp();

    try { await interaction.editReply({ embeds: [embed] }); } catch (e) { await interaction.followUp({ content: 'Scheduled.', ephemeral: true }); }
  }
};

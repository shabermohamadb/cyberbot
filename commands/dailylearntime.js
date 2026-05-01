const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { updateGuild, readData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dailylearntime')
    .setDescription('Set daily 10-minute learning time for this server (HH:MM 24h format)')
    .addStringOption(opt => opt.setName('time').setDescription('Time in HH:MM (24h), e.g. 21:00').setRequired(true))
    .addChannelOption(opt => opt.setName('vc').setDescription('Voice channel to mention').setRequired(true))
    .addChannelOption(opt => opt.setName('announce').setDescription('Text channel to send announcements').setRequired(true)),
  async execute(interaction) {
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }); } catch (e) { console.warn('deferReply failed (dailylearntime):', e && e.message); }
    const time = interaction.options.getString('time');
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return interaction.editReply('Invalid time format. Use HH:MM 24-hour format.');
    const vc = interaction.options.getChannel('vc');
    const announce = interaction.options.getChannel('announce');
    if (!vc) return interaction.editReply('Please provide a voice channel.');
    if (!announce) return interaction.editReply('Please provide an announcement (text) channel.');
    if (vc.type !== 2 && vc.type !== 'GUILD_VOICE' && vc.type !== 'VoiceBased') {
      // Best-effort check: proceed but warn if not voice
    }
    if (announce.type !== 0 && announce.type !== 'GUILD_TEXT' && announce.type !== 'TextBasedChannel') {
      // Best-effort: proceed but allow common types
    }
    // Only allow admins
    const member = interaction.member;
    if (!member || (!member.permissions.has(PermissionsBitField.Flags.Administrator) && !member.permissions.has(PermissionsBitField.Flags.ManageGuild))) {
      return interaction.editReply('Only server administrators may set the daily learning time.');
    }
    // Save to guild config
    await updateGuild(interaction.guildId, { dailyLearnTime: time, vcReminder: { time, channelId: vc.id, announceChannelId: announce.id } });
    interaction.editReply(`Daily learning time set to ${time} — VC: ${vc.name}, Announcements: ${announce.name} (timezone ${process.env.CRON_TZ || 'Asia/Kolkata'})`);
  }
};

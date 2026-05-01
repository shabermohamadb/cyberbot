const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Schedule daily motivation quote')
    .addStringOption(o => o.setName('time').setDescription('HH:MM (24h) e.g. 08:00').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Text channel to post quote in').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }
    const time = interaction.options.getString('time');
    const channel = interaction.options.getChannel('channel');
    try { await interaction.deferReply({ ephemeral: true }); } catch (e) {}

    await updateGuild(interaction.guild.id, { quoteSchedule: { time, channelId: channel.id } });

    const embed = new EmbedBuilder()
      .setTitle('✅ Quote Scheduled')
      .setDescription(`Daily motivation set at **${time}** in <#${channel.id}>`)
      .setColor(0x00AAFF)
      .setTimestamp();

    try { await interaction.editReply({ embeds: [embed] }); } catch (e) { await interaction.followUp({ content: 'Scheduled.', ephemeral: true }); }
  }
};

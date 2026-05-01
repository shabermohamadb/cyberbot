const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('information')
    .setDescription('Schedule daily technical information for students')
    .addStringOption(o => o.setName('time').setDescription('HH:MM (24h) e.g. 09:00').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Text channel to post information in').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }
    const time = interaction.options.getString('time');
    const channel = interaction.options.getChannel('channel');
    try { await interaction.deferReply({ ephemeral: true }); } catch (e) {}

    await updateGuild(interaction.guild.id, { infoSchedule: { time, channelId: channel.id } });

    const embed = new EmbedBuilder()
      .setTitle('✅ Information Scheduled')
      .setDescription(`Daily technical info set at **${time}** in <#${channel.id}>`)
      .setColor(0x00FF88)
      .setTimestamp();

    try { await interaction.editReply({ embeds: [embed] }); } catch (e) { await interaction.followUp({ content: 'Scheduled.', ephemeral: true }); }
  }
};

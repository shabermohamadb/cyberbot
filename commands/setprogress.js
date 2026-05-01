const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprogress')
    .setDescription('Set the progress channel for posting screenshots')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to set').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Admin only', ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    await updateGuild(interaction.guildId, { progressChannel: channel.id });
    await interaction.reply(`Progress channel set to ${channel}`);
  }
};

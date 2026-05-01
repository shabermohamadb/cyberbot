const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setai')
    .setDescription('Set the AI mentor channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to set').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Admin only', ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    await updateGuild(interaction.guildId, { aiChannel: channel.id });
    await interaction.reply(`AI channel set to ${channel}`);
  }
};

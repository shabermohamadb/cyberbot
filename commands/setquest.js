const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setquest')
    .setDescription('Set the quest/quiz channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to set').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Admin only', ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    await updateGuild(interaction.guildId, { questChannel: channel.id });
    await interaction.reply(`Quest channel set to ${channel}`);
  }
};

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { readData, updateUser } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removepoints')
    .setDescription('Remove progress points from a user (admin only)')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Points to remove').setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('User to remove points from').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }

    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }); } catch (e) {}

    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    if (!user) return interaction.editReply('User not found.');
    if (amount <= 0) return interaction.editReply('Amount must be positive.');

    const data = await readData();
    const u = (data.users && data.users[user.id]) || { progressPoints: 0, questPoints: 0 };
    const before = u.progressPoints || 0;
    const after = Math.max(0, before - amount);
    await updateUser(user.id, { progressPoints: after });

    return interaction.editReply({ content: `Removed ${amount} points from <@${user.id}>. ${before} → ${after}` });
  }
};

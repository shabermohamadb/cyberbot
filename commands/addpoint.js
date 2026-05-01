const { SlashCommandBuilder } = require('discord.js');

// Alias wrapper for /addpoints (singular name)
const handler = require('./addpoints');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addpoint')
    .setDescription('Alias for /addpoints (admin only)')
    .addIntegerOption(o => o.setName('amount').setDescription('Amount of points to add').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User to add points to').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('Type: progress or quiz').setRequired(false).addChoices(
      { name: 'progress', value: 'progress' },
      { name: 'quiz', value: 'quiz' }
    )),
  async execute(interaction) {
    // delegate to the main addpoints handler
    return handler.execute(interaction);
  }
};

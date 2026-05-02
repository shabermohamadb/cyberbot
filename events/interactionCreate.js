const { InteractionType, ButtonBuilder } = require('discord.js');
const { ensureGuild, ensureUser, updateUser, readData } = require('../utils/dataStore');
const { startQuiz } = require('../utils/quizManager');
const { checkAchievements } = require('../utils/achievements');
const processedInteractions = new Set();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // guard: skip duplicate interaction deliveries (Discord can occasionally deliver twice)
    try {
      if (processedInteractions.has(interaction.id)) return;
      processedInteractions.add(interaction.id);
      // remove marker after 30s to avoid memory growth
      setTimeout(() => { try { processedInteractions.delete(interaction.id); } catch (e) {} }, 30 * 1000);
    } catch (e) {}
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        await cmd.execute(interaction, client);
      } else if (interaction.isButton()) {
        // handled in quiz collector; keep for other buttons
      }
    } catch (e) {
      console.error('interaction error', e);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: 'Error executing command', ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content: 'Error executing command', ephemeral: true }).catch(() => {});
        }
      } catch (er) {
        console.warn('Failed to send error response for interaction', er && er.message);
      }
    }
  }
};

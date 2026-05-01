module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    // start cron jobs after client is ready
    try {
      const { startCrons } = require('../utils/cron');
      startCrons(client);
      console.log('Cron started');
    } catch (e) {
      console.error('Failed to start crons', e);
    }
    // Ensure guild-specific commands are cleared so global commands are the primary source.
    // This avoids duplicate slash commands appearing when both global and guild commands exist.
    try {
      const { REST, Routes } = require('discord.js');
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      const appId = process.env.CLIENT_ID || (client.application && client.application.id) || client.user.id;
      for (const [guildId] of client.guilds.cache) {
        try {
          const guildCommands = await rest.get(Routes.applicationGuildCommands(appId, guildId));
          if (Array.isArray(guildCommands) && guildCommands.length) {
            for (const gcmd of guildCommands) {
              try { await rest.delete(Routes.applicationGuildCommand(appId, guildId, gcmd.id)); } catch (e) {}
            }
            console.log('Cleared guild commands for', guildId);
          }
        } catch (err) {
          console.warn('Failed clearing guild commands for', guildId, err && err.message);
        }
      }
    } catch (e) {
      console.warn('Guild command cleanup failed', e && e.message);
    }
  }
};

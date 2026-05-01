const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild, client) {
    console.log('Joined guild', guild.id, guild.name);
    if (!process.env.CLIENT_ID) {
      console.warn('CLIENT_ID not set; cannot register guild commands for', guild.id);
      return;
    }

    try {
      const commands = [];
      const commandsPath = path.join(__dirname, '..', 'commands');
      if (fs.existsSync(commandsPath)) {
        for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
          const cmd = require(path.join(commandsPath, file));
          if (cmd.data) commands.push(cmd.data.toJSON());
        }
      }

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id), { body: commands });
      console.log('Registered commands to guild', guild.id);
    } catch (e) {
      console.error('Failed to register commands for guild', guild.id, e && e.message || e);
    }
  }
};

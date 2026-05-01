require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering commands...');
    // Register global commands (may take up to an hour to propagate to all guilds)
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Registered global commands');
    // If a GUILD_ID is provided (useful for testing), also register guild commands immediately
    if (process.env.GUILD_ID) {
      try {
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log('Also registered commands for guild', process.env.GUILD_ID, '(immediate availability)');
      } catch (gErr) {
        console.warn('Failed to register guild commands for', process.env.GUILD_ID, gErr && gErr.message);
      }
    } else {
      console.log('No GUILD_ID provided — global commands registered (may take up to 1 hour to appear).');
    }
  } catch (err) {
    console.error('Failed to register commands', err && err.message);
  }
})();

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commandsPath = path.join(__dirname, '..', 'commands');
if (!fs.existsSync(commandsPath)) {
  console.error('commands folder not found');
  process.exit(1);
}
const commands = [];
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const appId = process.env.CLIENT_ID;
if (!appId) {
  console.error('CLIENT_ID missing in .env');
  process.exit(1);
}

(async () => {
  try {
    console.log('Resetting global commands (will overwrite existing global commands)...');
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('Global commands updated:', commands.map(c => c.name).join(', '));

    // remove guild commands for all guilds listed in data.json (if present)
    const dataPath = path.join(__dirname, '..', 'data.json');
    let guildIds = [];
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      guildIds = Object.keys(data.guilds || {});
    }
    if (guildIds.length === 0) {
      console.log('No guilds found in data.json to clean. Skipping guild cleanup.');
      return;
    }

    for (const gid of guildIds) {
      try {
        console.log('Checking guild', gid);
        const gcmds = await rest.get(Routes.applicationGuildCommands(appId, gid));
        if (Array.isArray(gcmds) && gcmds.length) {
          for (const g of gcmds) {
            try {
              await rest.delete(Routes.applicationGuildCommand(appId, gid, g.id));
              console.log('Deleted guild command', g.name, 'from', gid);
            } catch (e) {
              console.warn('Failed deleting command', g.id, e && e.message);
            }
          }
        } else {
          console.log('No guild commands for', gid);
        }
      } catch (e) {
        console.warn('Failed to fetch guild commands for', gid, e && e.message);
      }
    }

    console.log('Reset complete');
  } catch (e) {
    console.error('Reset failed', e && e.message);
    process.exit(1);
  }
})();

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
if (!fs.existsSync(dataPath)) {
  console.error('data.json not found');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const guildIds = Object.keys(data.guilds || {});
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN missing in .env');
  process.exit(1);
}
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const appId = process.env.CLIENT_ID;

(async () => {
  try {
    if (!appId) throw new Error('CLIENT_ID missing in .env');
    for (const gid of guildIds) {
      try {
        console.log('Checking guild', gid);
        const cmds = await rest.get(Routes.applicationGuildCommands(appId, gid));
        if (Array.isArray(cmds) && cmds.length) {
          for (const c of cmds) {
            try {
              await rest.delete(Routes.applicationGuildCommand(appId, gid, c.id));
              console.log('Deleted guild command', c.name, 'from', gid);
            } catch (e) {
              console.warn('Failed deleting command', c.id, e && e.message);
            }
          }
        } else {
          console.log('No guild commands for', gid);
        }
      } catch (e) {
        console.warn('Error fetching guild commands for', gid, e && e.message);
      }
    }
    console.log('Done');
  } catch (e) {
    console.error('Script failed', e && e.message);
    process.exit(1);
  }
})();

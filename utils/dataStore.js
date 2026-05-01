const fs = require('fs').promises;
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data.json');
let writeLock = false;

async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: {}, guilds: {} };
  }
}

async function writeData(data) {
  // simple lock to avoid concurrent writes
  while (writeLock) await new Promise(r => setTimeout(r, 10));
  writeLock = true;
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  writeLock = false;
}

async function ensureGuild(guildId) {
  const data = await readData();
  if (!data.guilds) data.guilds = {};
  if (!data.guilds[guildId]) data.guilds[guildId] = { progressChannel: null, questChannel: null, aiChannel: null, vcReminder: null, quoteSchedule: null, infoSchedule: null, dailyLearnTime: null };
  await writeData(data);
  return data.guilds[guildId];
}

async function ensureUser(userId) {
  const data = await readData();
  if (!data.users) data.users = {};
  if (!data.users[userId]) {
    data.users[userId] = {
      progressPoints: 0,
      questPoints: 0,
      progressStrikes: 0,
      quizStrikes: 0,
      streak: 0,
      quizStreak: 0,
      lastProgress: null,
      achievements: []
    };
    await writeData(data);
  }
  return data.users[userId];
}

async function updateUser(userId, patch) {
  const data = await readData();
  data.users = data.users || {};
  data.users[userId] = Object.assign(data.users[userId] || {}, patch);
  await writeData(data);
  return data.users[userId];
}

async function updateGuild(guildId, patch) {
  const data = await readData();
  data.guilds = data.guilds || {};
  data.guilds[guildId] = Object.assign(data.guilds[guildId] || { progressChannel: null, questChannel: null, aiChannel: null, vcReminder: null, quoteSchedule: null, infoSchedule: null, dailyLearnTime: null }, patch);
  await writeData(data);
  return data.guilds[guildId];
}

module.exports = { readData, writeData, ensureGuild, ensureUser, updateUser, updateGuild };

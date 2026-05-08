const fs = require('fs').promises;
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data.json');
const LOCK_PATH = DATA_PATH + '.lock';
let writeLock = false;

async function _acquireFileLock(timeout = 5000) {
  const start = Date.now();
  while (true) {
    try {
      const fh = await fs.open(LOCK_PATH, 'wx');
      await fh.close();
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 50));
      if (Date.now() - start > timeout) throw new Error('data lock timeout');
    }
  }
}

async function _releaseFileLock() {
  try { await fs.unlink(LOCK_PATH); } catch (e) {}
}

// perform a read-modify-write under an OS-level lock to avoid cross-process races
async function withDataLock(fn) {
  await _acquireFileLock();
  try {
    let raw = '{}';
    try { raw = await fs.readFile(DATA_PATH, 'utf-8'); } catch (e) { raw = '{}'; }
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch (e) { data = {}; }
    const res = await fn(data);
    try { await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8'); } catch (e) { throw e; }
    return res;
  } finally {
    await _releaseFileLock();
  }
}

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
  return await withDataLock(async (data) => {
    if (!data.guilds) data.guilds = {};
    if (!data.guilds[guildId]) data.guilds[guildId] = { progressChannel: null, questChannel: null, aiChannel: null, vcReminder: null, quoteSchedule: null, infoSchedule: null, dailyLearnTime: null };
    const g = data.guilds[guildId];
    if (typeof g.lastQuoteDate === 'undefined') g.lastQuoteDate = null;
    if (typeof g.lastInfoDate === 'undefined') g.lastInfoDate = null;
    if (typeof g.lastQuizDate === 'undefined') g.lastQuizDate = null;
    if (typeof g.lastEveningDate === 'undefined') g.lastEveningDate = null;
    if (typeof g.lastNightDate === 'undefined') g.lastNightDate = null;
    if (typeof g.lastDailyLearnDate === 'undefined') g.lastDailyLearnDate = null;
    if (typeof g.lastQuoteIndex === 'undefined') g.lastQuoteIndex = null;
    if (typeof g.lastInfoIndex === 'undefined') g.lastInfoIndex = null;
    return data.guilds[guildId];
  });
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
  return await withDataLock(async (data) => {
    data.guilds = data.guilds || {};
    data.guilds[guildId] = Object.assign(data.guilds[guildId] || { progressChannel: null, questChannel: null, aiChannel: null, vcReminder: null, quoteSchedule: null, infoSchedule: null, dailyLearnTime: null }, patch);
    return data.guilds[guildId];
  });
}

// Try to claim a per-guild key (like lastQuizDate) for the given date string.
// Returns true if we successfully claimed (set a processing marker), false if it's already set for today.
async function claimGuildKeyForDate(guildId, key, dateStr) {
  return await withDataLock(async (data) => {
    data.guilds = data.guilds || {};
    data.guilds[guildId] = data.guilds[guildId] || {};
    const g = data.guilds[guildId];
    const cur = g[key];
    if (cur === dateStr) return false; // already done for today
    // if currently processing and recent, do not claim
    if (typeof cur === 'string' && cur.startsWith('processing:')) {
      const parts = cur.split(':');
      const ts = parseInt(parts[2] || '0', 10) || 0;
      if (Date.now() - ts < 2 * 60 * 1000) return false; // another process is working
    }
    g[key] = `processing:${process.pid}:${Date.now()}`;
    return true;
  });
}

// Finalize the guild date key to the actual date (e.g., '2026-05-08') and optional extra patch
async function finalizeGuildDate(guildId, key, dateStr, extraPatch) {
  return await withDataLock(async (data) => {
    data.guilds = data.guilds || {};
    data.guilds[guildId] = data.guilds[guildId] || {};
    const g = data.guilds[guildId];
    g[key] = dateStr;
    if (extraPatch && typeof extraPatch === 'object') {
      for (const k of Object.keys(extraPatch)) g[k] = extraPatch[k];
    }
    return g;
  });
}

// Clear a processing marker on failure so others can retry
async function clearGuildProcessing(guildId, key) {
  return await withDataLock(async (data) => {
    data.guilds = data.guilds || {};
    data.guilds[guildId] = data.guilds[guildId] || {};
    const g = data.guilds[guildId];
    const cur = g[key];
    if (typeof cur === 'string' && cur.startsWith('processing:')) g[key] = null;
    return g;
  });
}

module.exports = { readData, writeData, ensureGuild, ensureUser, updateUser, updateGuild, claimGuildKeyForDate, finalizeGuildDate, clearGuildProcessing };

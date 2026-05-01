require('dotenv').config();
const cron = require('node-cron');
const { readData, updateUser } = require('./dataStore');
const { startQuiz } = require('./quizManager');

const TIMEZONE = process.env.CRON_TZ || 'Asia/Kolkata';
const dailySent = {}; // guildId -> date string to prevent duplicate sends

// track per-guild scheduled jobs so we can cancel/reschedule
const guildDailyJobs = new Map(); // guildId -> cron.Job

const QUOTES = [
  "Small steps every day lead to big results.",
  "Consistency beats intensity — keep showing up.",
  "Learn a little, improve a lot. You've got this!",
  "Today +1% better than yesterday. Keep going.",
  "Progress is progress — celebrate small wins."
];

const TECH_INFO = [
  // Coding tips
  "Coding: Keep functions small and focused — one responsibility per function improves readability.",
  "Coding: Write tests for edge cases and use linting to keep code consistent.",
  "Coding: Use version control branches for features and write clear commit messages.",
  // Data structures & algorithms
  "Data Structure: Use hash maps for fast key-value lookups (O(1)) when order isn't required.",
  "Algorithms: Learn sorting algorithms (quick/merge) and when to use them based on stability and average-case performance.",
  "DS Tip: Prefer arrays for ordered collections and linked lists when you need cheap insertions/removals in the middle.",
  // Cybersecurity
  "Security: Keep dependencies up-to-date and run vulnerability scans regularly.",
  "Security: Never commit secrets — use environment variables or a secrets manager.",
  "Security: Use strong, unique passwords and enable 2FA for critical accounts.",
  // Tech news / career
  "News: Follow major open-source releases and RFCs to stay current with platform changes.",
  "Career: Build a portfolio project that demonstrates end-to-end thinking (frontend, backend, tests, docs).",
  // Study habits
  "Study Habit: Break learning into 25-minute focused sessions (Pomodoro) and review notes afterward.",
  "Reminder: Practice whiteboard problems to improve problem-solving under pressure."
];

async function morningTask(client) {
  console.log('Cron: morning task running');
  const data = await readData();
  for (const guildId of Object.keys(data.guilds || {})) {
    const g = data.guilds[guildId];
    if (!g || !g.progressChannel) continue;
    const ch = await client.channels.fetch(g.progressChannel).catch(() => null);
    if (ch) {
      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      const embed = {
        title: '🌅 Daily Motivation',
        description: `💬 ${q}`,
        footer: { text: 'Stay consistent 🔥' },
        timestamp: new Date()
      };
      ch.send({ embeds: [embed] });
      console.log('Motivation sent to', guildId);
    }
  }
}

async function quizTask(client) {
  console.log('Cron: quiz task running');
  const data = await readData();
  for (const guildId of Object.keys(data.guilds || {})) {
    const g = data.guilds[guildId];
    if (!g.questChannel) continue;
    const ch = await client.channels.fetch(g.questChannel).catch(() => null);
    if (ch) {
      try {
        console.log('Cron: sending quiz to', guildId);
        await startQuiz(ch, client);
      } catch (e) { console.error('Quiz send failed', e); }
    }
  }
}

async function eveningTask(client) {
  console.log('Cron: evening task running');
  const data = await readData();
  for (const guildId of Object.keys(data.guilds || {})) {
    const g = data.guilds[guildId];
    if (!g.progressChannel) continue;
    const ch = await client.channels.fetch(g.progressChannel).catch(() => null);
    if (ch) ch.send('⏰ Reminder: Post a progress screenshot to keep your streak alive — consistency wins.');
  }
}

async function nightTask(client) {
  console.log('Cron: night task running');
  const data = await readData();
  const now = Date.now();
  for (const guildId of Object.keys(data.guilds || {})) {
    const g = data.guilds[guildId];
    if (!g.questChannel) continue;
    // add strike to users who haven't posted progress today
    for (const [uid, u] of Object.entries(data.users || {})) {
      const last = u.lastProgress ? new Date(u.lastProgress).getTime() : 0;
      const oneDay = 24 * 60 * 60 * 1000;
      if (now - last > oneDay) {
        const strikes = (u.progressStrikes || 0) + 1;
        await updateUser(uid, { progressStrikes: strikes });
      }
    }
    const ch = await client.channels.fetch(g.questChannel).catch(() => null);
    if (ch) {
      const users = Object.entries(data.users || {}).map(([id, u]) => ({ id, progressPoints: u.progressPoints || 0 }));
      users.sort((a, b) => b.progressPoints - a.progressPoints);
      const top = users.slice(0, 3).map((u, i) => `#${i + 1} <@${u.id}> — ${u.progressPoints} pts`).join('\n') || 'No users yet.';
      ch.send(`Nightly leaderboard:\n${top}`);
    }
  }
}

function startCrons(client) {
  // morning
  cron.schedule(process.env.CRON_MORNING || '0 8 * * *', () => morningTask(client), { timezone: TIMEZONE });
  // quiz
  cron.schedule(process.env.CRON_QUIZ || '0 12 * * *', () => quizTask(client), { timezone: TIMEZONE });
  // evening
  cron.schedule(process.env.CRON_EVENING || '0 18 * * *', () => eveningTask(client), { timezone: TIMEZONE });
  // night
  cron.schedule(process.env.CRON_NIGHT || '0 22 * * *', () => nightTask(client), { timezone: TIMEZONE });
  // per-minute check for guild-specific daily learning time
  cron.schedule('* * * * *', async () => {
    try {
      const data = await readData();
      const now = new Date();
      const hhmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE });
      console.log('Cron minute check, time=', hhmm);
      for (const guildId of Object.keys(data.guilds || {})) {
        const g = data.guilds[guildId];
        if (!g) continue;
        if (g.quoteSchedule || g.infoSchedule || g.dailyLearnTime) {
          console.log(`Guild ${guildId} schedules -> quote:${g.quoteSchedule && g.quoteSchedule.time} info:${g.infoSchedule && g.infoSchedule.time} learn:${g.dailyLearnTime}`);
        }

        // daily learning VC reminder
        if (g.dailyLearnTime && g.dailyLearnTime === hhmm) {
          const last = dailySent[guildId + '-dailyLearn'];
          const todayKey = now.toISOString().slice(0,10);
          if (last !== todayKey) {
            dailySent[guildId + '-dailyLearn'] = todayKey;
            const announceId = g.vcReminder && g.vcReminder.announceChannelId ? g.vcReminder.announceChannelId : null;
            const targetChId = announceId || g.progressChannel || g.questChannel;
            const ch = targetChId ? await client.channels.fetch(targetChId).catch(() => null) : null;
            const vcMention = g.vcReminder && g.vcReminder.channelId ? `<#${g.vcReminder.channelId}>` : '';
            if (ch) {
              const embed = {
                title: '🔥 DAILY LEARNING TIME! ',
                description: `⏰ Time: ${g.dailyLearnTime}\n🎧 Join VC: ${vcMention}\n📚 Duration: 10 Minutes\n\n💡 "Just 10 minutes daily can change your future."`,
                footer: { text: 'Let\'s grow together!' },
                timestamp: new Date()
              };
              await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
              console.log('VC reminder triggered for', guildId, g.dailyLearnTime, 'announced in', ch && ch.id);
            }
          }
        }

        // Quote schedule
        if (g.quoteSchedule && g.quoteSchedule.time === hhmm) {
          const last = dailySent[guildId + '-quote'];
          const todayKey = now.toISOString().slice(0,10);
          if (last !== todayKey) {
            dailySent[guildId + '-quote'] = todayKey;
            const ch = g.quoteSchedule.channelId ? await client.channels.fetch(g.quoteSchedule.channelId).catch(() => null) : null;
            if (ch) {
              const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
              const embed = { title: '🌅 Daily Motivation', description: `💬 ${q}`, footer: { text: 'Stay consistent 🔥' }, timestamp: new Date() };
              await ch.send({ embeds: [embed] }).catch(() => null);
              console.log('Quote sent to', guildId, g.quoteSchedule.channelId);
            }
          }
        }

        // Information schedule
        if (g.infoSchedule && g.infoSchedule.time === hhmm) {
          const last = dailySent[guildId + '-info'];
          const todayKey = now.toISOString().slice(0,10);
          if (last !== todayKey) {
            dailySent[guildId + '-info'] = todayKey;
            const ch = g.infoSchedule.channelId ? await client.channels.fetch(g.infoSchedule.channelId).catch(() => null) : null;
            if (ch) {
              const info = TECH_INFO[Math.floor(Math.random() * TECH_INFO.length)];
              const embed = { title: '📘 Daily Tech Info', description: `${info}`, footer: { text: 'Useful for students — learn daily' }, timestamp: new Date() };
              await ch.send({ embeds: [embed] }).catch(() => null);
              console.log('Info sent to', guildId, g.infoSchedule.channelId);
            }
          }
        }
      }
    } catch (e) {
      console.error('Daily learn check failed', e);
    }
  }, { timezone: TIMEZONE });
  // schedule per-guild daily jobs saved in data.json
  (async () => {
    try {
      const data = await readData();
      for (const guildId of Object.keys(data.guilds || {})) {
        const g = data.guilds[guildId];
        if (g && g.dailyLearnTime) {
          try {
            await scheduleGuildDaily(client, guildId, g.dailyLearnTime, g.vcReminder || null);
          } catch (e) { console.warn('Failed to schedule saved daily for', guildId, e && e.message); }
        }
      }
    } catch (e) { console.warn('Failed to load saved guild schedules', e && e.message); }
  })();
  console.log('Cron jobs scheduled (timezone:', TIMEZONE, ')');
}

// Convert HH:MM to cron expression 'M H * * *'
function hhmmToCron(time) {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hh, mm] = time.split(':');
  return `${parseInt(mm, 10)} ${parseInt(hh, 10)} * * *`;
}

async function scheduleGuildDaily(client, guildId, time, vcReminder) {
  // cancel existing
  try {
    if (guildDailyJobs.has(guildId)) {
      const existing = guildDailyJobs.get(guildId);
      try { existing.stop(); } catch (e) {}
      guildDailyJobs.delete(guildId);
      console.log('Cancelled existing daily job for', guildId);
    }
    const cronExpr = hhmmToCron(time);
    if (!cronExpr) return console.warn('Invalid time for scheduling daily:', time);
    const job = cron.schedule(cronExpr, async () => {
      try {
        console.log('VC Reminder triggered for', guildId, 'time', time);
        const data = await readData();
        const g = data.guilds && data.guilds[guildId];
        const announceId = (vcReminder && vcReminder.announceChannelId) || (g && g.vcReminder && g.vcReminder.announceChannelId) || null;
        const targetChId = announceId || (g && (g.progressChannel || g.questChannel));
        const ch = targetChId ? await client.channels.fetch(targetChId).catch(() => null) : null;
        const vcMention = (vcReminder && vcReminder.channelId) || (g && g.vcReminder && g.vcReminder.channelId) ? `<#${(vcReminder && vcReminder.channelId) || (g && g.vcReminder && g.vcReminder.channelId)}>` : '';
        if (ch) {
          const embed = {
            title: '🔥 DAILY LEARNING TIME! ',
            description: `⏰ Time: ${time}\n🎧 Join VC: ${vcMention}\n📚 Duration: 10 Minutes\n\n💡 "Just 10 minutes daily can change your future."`,
            footer: { text: "Let's grow together!" },
            timestamp: new Date()
          };
          await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
          console.log('VC reminder sent for', guildId, 'announced in', ch.id);
        }
      } catch (e) {
        console.error('Error in scheduled daily job for', guildId, e);
      }
    }, { timezone: TIMEZONE });
    guildDailyJobs.set(guildId, job);
    console.log('VC Reminder scheduled at', time, 'for guild', guildId, 'cron=', cronExpr);
  } catch (e) {
    console.error('Failed to schedule guild daily', guildId, e);
  }
}

function cancelGuildDaily(guildId) {
  if (guildDailyJobs.has(guildId)) {
    try { guildDailyJobs.get(guildId).stop(); } catch (e) {}
    guildDailyJobs.delete(guildId);
    console.log('Cancelled guild daily job for', guildId);
  }
}

module.exports = { startCrons, scheduleGuildDaily, cancelGuildDaily };

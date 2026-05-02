require('dotenv').config();
const cron = require('node-cron');
const { readData, updateUser, updateGuild } = require('./dataStore');
const { startQuiz } = require('./quizManager');
const { EmbedBuilder } = require('discord.js');

const TIMEZONE = process.env.CRON_TZ || 'Asia/Kolkata';
const dailySent = {}; // guildId -> date string to prevent duplicate sends
let cronsStarted = false; // guard to avoid scheduling twice

// track per-guild scheduled jobs so we can cancel/reschedule
const guildDailyJobs = new Map(); // guildId -> cron.Job

const QUOTES = [
  "Success is built daily, not suddenly.",
  "Show up even when you don’t feel like it.",
  "Discipline creates the life motivation can’t sustain.",
  "One step daily beats zero steps perfectly.",
  "Consistency turns effort into results.",
  "You don’t need speed, you need direction.",
  "Small habits build powerful futures.",
  "Progress is silent but powerful.",
  "Winners repeat boring routines daily.",
  "Motivation fades, discipline stays.",
  "Keep going — even slow progress counts.",
  "Your future is built by today’s actions.",
  "No shortcuts, only consistency.",
  "Focus > Talent.",
  "Daily grind creates long-term shine.",
  "Effort today = results tomorrow.",
  "Consistency beats intensity.",
  "Growth happens in repetition.",
  "Be better than yesterday, that’s enough.",
  "Show up. Do the work. Repeat.",
  "You don’t fail, you just learn slower.",
  "Success loves routine.",
  "Hard work compounds silently.",
  "Discipline is self-respect in action.",
  "Small wins create big confidence.",
  "Stay patient, stay consistent.",
  "Results follow habits.",
  "Focus on process, not outcome.",
  "Daily effort beats random bursts.",
  "Trust the process, not the mood.",
  "Progress over perfection.",
  "Consistency builds unstoppable momentum.",
  "Your grind will pay off — just wait.",
  "Stay locked in, no distractions.",
  "Dreams demand discipline.",
  "Hustle quietly, win loudly.",
  "Keep pushing, no excuses.",
  "Repetition creates mastery.",
  "Effort never goes to waste.",
  "Keep improving, no matter what.",
  "Discipline is doing it tired.",
  "Results respect consistency.",
  "No pressure, just progress.",
  "You vs You — daily battle.",
  "Stay hungry, stay focused.",
  "Every day matters.",
  "Consistency creates confidence.",
  "Your habits define your future.",
  "Work now, shine later.",
  "Never skip the grind."
];

const TECH_INFO = [
  "A program is a set of instructions executed by a computer.",
  "Source code is written by developers in programming languages.",
  "Machine code is binary executed directly by the CPU.",
  "Compilers convert code into machine language before execution.",
  "Interpreters execute code line by line.",
  "JavaScript is a high-level, interpreted language.",
  "Python emphasizes readability and simplicity.",
  "C is a low-level, high-performance programming language.",
  "Java uses a virtual machine (JVM) for portability.",
  "TypeScript adds static typing to JavaScript.",

  "Variables store data in memory.",
  "Constants cannot be reassigned after initialization.",
  "Data types define the kind of data stored.",
  "Primitive types include number, string, boolean.",
  "Reference types include objects and arrays.",
  "Functions encapsulate reusable logic.",
  "Arrow functions provide shorter syntax in JS.",
  "Closures allow access to outer scope variables.",
  "Scopes control variable visibility.",
  "Global scope is accessible everywhere.",

  "Local scope is limited to a block or function.",
  "Hoisting moves declarations to the top.",
  "Callbacks are functions passed as arguments.",
  "Promises handle async operations.",
  "Async/await simplifies asynchronous code.",
  "Event-driven programming reacts to events.",
  "The event loop manages async execution in JS.",
  "Threads allow parallel execution.",
  "Single-threaded means one task at a time.",
  "Multithreading improves performance.",

  "Arrays store ordered collections.",
  "Linked lists store elements as nodes.",
  "Stacks follow LIFO principle.",
  "Queues follow FIFO principle.",
  "Trees represent hierarchical data.",
  "Graphs represent networks of nodes.",
  "Hash maps store key-value pairs efficiently.",
  "Sorting arranges data in order.",
  "Searching finds specific elements.",
  "Binary search works on sorted data.",

  "Algorithms solve computational problems.",
  "Time complexity measures speed.",
  "Space complexity measures memory usage.",
  "Big-O notation describes performance.",
  "O(1) is constant time.",
  "O(n) is linear time.",
  "O(log n) is logarithmic time.",
  "O(n^2) is quadratic time.",
  "Recursion solves problems via self-calls.",
  "Base case stops recursion.",

  "Iteration uses loops to repeat tasks.",
  "For loops run a fixed number of times.",
  "While loops run until a condition fails.",
  "Do-while runs at least once.",
  "Break exits loops early.",
  "Continue skips to next iteration.",
  "Debugging finds and fixes errors.",
  "Syntax errors break code execution.",
  "Runtime errors occur during execution.",
  "Logical errors produce wrong results.",

  "Version control tracks code changes.",
  "Git is the most popular VCS.",
  "Repositories store project files.",
  "Commits save snapshots of code.",
  "Branches allow parallel development.",
  "Merging combines branches.",
  "Pull requests review changes.",
  "CI/CD automates testing and deployment.",
  "Build systems compile and bundle code.",
  "Package managers install dependencies.",

  "NPM manages JavaScript packages.",
  "APIs enable software communication.",
  "REST APIs use HTTP methods.",
  "GraphQL allows flexible queries.",
  "Endpoints define API routes.",
  "JSON is used for data exchange.",
  "XML is another data format.",
  "Authentication verifies identity.",
  "JWT is used for secure auth.",
  "OAuth enables third-party login.",

  "Frontend handles UI and UX.",
  "Backend manages logic and databases.",
  "Full-stack developers handle both.",
  "HTML structures web pages.",
  "CSS styles web pages.",
  "JavaScript adds interactivity.",
  "React is a frontend library.",
  "Node.js runs JS on servers.",
  "Express is a Node.js framework.",
  "Databases store persistent data.",

  "SQL databases use structured tables.",
  "NoSQL databases are flexible.",
  "MongoDB is a NoSQL database.",
  "Indexes speed up queries.",
  "Normalization reduces redundancy.",
  "Caching improves performance.",
  "Redis is used for caching.",
  "Load balancing distributes traffic.",
  "Microservices split applications.",
  "Monolith is a single large system.",

  "Docker packages apps into containers.",
  "Kubernetes manages containers.",
  "Cloud computing provides scalability.",
  "AWS is a major cloud provider.",
  "Serverless runs code without servers.",
  "Virtual machines emulate hardware.",
  "Operating systems manage resources.",
  "Linux is widely used in servers.",
  "Windows is common for desktops.",
  "MacOS is Unix-based.",

  "Encryption secures data.",
  "Hashing creates fixed-length values.",
  "HTTPS ensures secure communication.",
  "Firewalls protect networks.",
  "VPN secures internet traffic.",
  "Latency is network delay.",
  "Bandwidth is data capacity.",
  "CDN speeds up content delivery.",
  "DNS resolves domain names.",
  "IP addresses identify devices.",

  "Unit testing tests individual parts.",
  "Integration testing tests modules together.",
  "E2E testing tests full workflows.",
  "Test automation saves time.",
  "Refactoring improves code structure.",
  "Clean code improves readability.",
  "Design patterns solve common problems.",
  "MVC separates concerns.",
  "Agile is iterative development.",
  "Scrum is a popular Agile framework."
];

function pickRandomAvoidRepeat(arr, lastIndex) {
  if (!Array.isArray(arr) || arr.length === 0) return { item: null, index: -1 };
  if (arr.length === 1) return { item: arr[0], index: 0 };
  let idx = Math.floor(Math.random() * arr.length);
  if (idx === lastIndex) {
    idx = (idx + 1) % arr.length;
  }
  return { item: arr[idx], index: idx };
}

async function morningTask(client) {
  console.log('Cron: morning task running');
  const data = await readData();
  for (const guildId of Object.keys(data.guilds || {})) {
    const g = data.guilds[guildId];
    if (!g || !g.progressChannel) continue;
    const ch = await client.channels.fetch(g.progressChannel).catch(() => null);
    if (ch) {
      const todayKey = new Date().toISOString().slice(0,10);
      // check guild-stored lastQuoteDate to avoid duplicates across restarts
      if (g.lastQuoteDate && g.lastQuoteDate === todayKey) {
        console.log('Morning motivation already sent today for', guildId);
        continue;
      }
      const pick = pickRandomAvoidRepeat(QUOTES, g.lastQuoteIndex);
      const q = pick.item;
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('💡 Daily Motivation')
        .setDescription([
          '💬 **Hey everyone! Hope you\'re doing great 😊**',
          '',
          '📌 Stay consistent with your daily learning!',
          '',
          '💡 **Today\'s Motivation:**',
          `"${q}"`,
          '',
          '🔥 Keep pushing — you\'re improving!'
        ].join('\n'))
        .setFooter({ text: 'Stay consistent 🔥' })
        .setTimestamp();
      await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
      await updateGuild(guildId, { lastQuoteDate: todayKey, lastQuoteIndex: pick.index });
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
        const todayKey = new Date().toISOString().slice(0, 10);
        if (g.lastQuizDate && g.lastQuizDate === todayKey) {
          console.log('Quiz already sent today for', guildId);
          continue;
        }
        console.log('Cron: sending quiz to', guildId);
        const active = await startQuiz(ch, client);
        if (active) {
          await updateGuild(guildId, { lastQuizDate: todayKey });
        }
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
    if (ch) {
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setDescription(['📌 **Reminder**', '', '⏳ Post a progress screenshot to keep your streak alive — consistency wins.'].join('\n'))
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => null);
    }
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
        const top = users.slice(0, 5).map((u, i) => {
          if (i === 0) return `🥇 1. <@${u.id}> — ${u.progressPoints} pts`;
          if (i === 1) return `🥈 2. <@${u.id}> — ${u.progressPoints} pts`;
          if (i === 2) return `🥉 3. <@${u.id}> — ${u.progressPoints} pts`;
          return `${i + 1}. <@${u.id}> — ${u.progressPoints} pts`;
        }).join('\n') || 'No users yet.';
        const embed = new EmbedBuilder()
          .setTitle('🏆 Nightly Leaderboard')
          .setDescription(top)
          .setColor(0xFFD700)
          .setTimestamp()
          .setFooter({ text: 'Keep grinding 🔥' });
        await ch.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

function startCrons(client) {
  if (cronsStarted) return;
  cronsStarted = true;
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
          // If we've scheduled a dedicated per-guild job for this guild, let that job handle the announcement
          if (guildDailyJobs.has(guildId)) {
            // per-guild cron will trigger at the same time; skip per-minute dispatcher
            continue;
          }
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

        // Quote schedule (per-guild)
        if (g.quoteSchedule && g.quoteSchedule.time === hhmm) {
          const todayKey = now.toISOString().slice(0,10);
          if (!g.lastQuoteDate || g.lastQuoteDate !== todayKey) {
            const ch = g.quoteSchedule.channelId ? await client.channels.fetch(g.quoteSchedule.channelId).catch(() => null) : null;
            if (ch) {
              const pick = pickRandomAvoidRepeat(QUOTES, g.lastQuoteIndex);
              const q = pick.item;
              const embed = new EmbedBuilder()
                .setTitle('💡 Daily Motivation')
                .setColor(0x0099FF)
                .setDescription(['💬 **Hey everyone! Hope you\'re doing great 😊**', '', '📌 Stay consistent with your daily learning!', '', '💡 **Today\'s Motivation:**', `"${q}"`, '', '🔥 Keep pushing — you\'re improving!'].join('\n'))
                .setFooter({ text: 'Stay consistent 🔥' })
                .setTimestamp();
              await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
              await updateGuild(guildId, { lastQuoteDate: todayKey, lastQuoteIndex: pick.index });
              console.log('Quote sent to', guildId, g.quoteSchedule.channelId);
            }
          }
        }

        // Information schedule (per-guild)
        if (g.infoSchedule && g.infoSchedule.time === hhmm) {
          const todayKey = now.toISOString().slice(0,10);
          if (!g.lastInfoDate || g.lastInfoDate !== todayKey) {
            const ch = g.infoSchedule.channelId ? await client.channels.fetch(g.infoSchedule.channelId).catch(() => null) : null;
            if (ch) {
              const pick = pickRandomAvoidRepeat(TECH_INFO, g.lastInfoIndex);
              const info = pick.item;
              const embed = new EmbedBuilder()
                .setTitle('📢 Daily Learning Tip')
                .setColor(0x7B61FF)
                .setDescription(['📢 **Daily Learning Tip**', '', `🧠 Topic: ${info.split(':')[0] || 'General'}`, '', `💡 Tip:\n"${info.replace(/^\w+:\s*/,'')}"`, '', '🚀 Small knowledge daily = big growth!'].join('\n'))
                .setFooter({ text: 'Keep learning 🚀' })
                .setTimestamp();
              await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
              await updateGuild(guildId, { lastInfoDate: todayKey, lastInfoIndex: pick.index });
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

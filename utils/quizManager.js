require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const cron = require('node-cron');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensureUser, readData, updateUser } = require('./dataStore');
const { calcXP } = require('./xp');
const { checkAchievements } = require('./achievements');
const { Configuration, OpenAIApi } = require('openai');
const QUIZ_BASE_POINTS = parseInt(process.env.QUIZ_BASE_POINTS || '5', 10);

const QUESTIONS_PATH = path.join(__dirname, '..', 'questions.json');
let activeQuiz = null; // in-memory: { guildId, question, message, startedAt, responses }

// decode HTML entities returned by OpenTDB
function decodeHTMLEntities(text) {
  if (!text) return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&uuml;/g, 'ü')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

async function loadLocalQuestion() {
  try {
    const raw = await fs.readFile(QUESTIONS_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    const pick = arr[Math.floor(Math.random() * arr.length)];
    return {
      question: pick.question,
      choices: pick.choices,
      correct: pick.correct,
      difficulty: pick.difficulty || 'medium'
    };
  } catch (e) {
    return null;
  }
}

// Fetch from Open Trivia DB (category 18 = Science: Computers)
async function getQuestion() {
  try {
    const attempts = 4;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const url = process.env.OPENTDB_URL || 'https://opentdb.com/api.php?amount=1&category=18&type=multiple';
      const res = await fetch(url);
      const json = await res.json();
      if (!json || !json.results || !json.results[0]) continue;
      const q = json.results[0];
      const question = decodeHTMLEntities(q.question);
      const correct = decodeHTMLEntities(q.correct_answer);
      let incorrect = (q.incorrect_answers || []).map(decodeHTMLEntities).filter(a => a && a.trim());
      // remove any incorrect that equals correct
      incorrect = Array.from(new Set(incorrect.filter(a => a !== correct)));
      // need exactly 3 unique incorrect options; if not, retry
      if (incorrect.length < 3) continue;
      // trim whitespace
      incorrect = incorrect.map(a => a.trim());
      return { question, correct: correct.trim(), incorrect, difficulty: q.difficulty || 'medium' };
    }
    // fallback to local if API failed to provide clean options
    console.log('OpenTDB returned no usable question after attempts — using fallback');
    return await loadLocalQuestion();
  } catch (e) {
    console.log('OpenTDB API fetch failed, using fallback. Error:', e && e.message);
    return await loadLocalQuestion();
  }
}

// Public wrappers to provide clear, testable functions per requirements
async function getQuizFromAPI() {
  return await getQuestion();
}

async function getFallbackQuiz() {
  return await loadLocalQuestion();
}

function decodeHTML(text) {
  return decodeHTMLEntities(text);
}

async function sendQuiz(channel, client, seconds) {
  return await startQuiz(channel, client, seconds);
}

function shuffleOptions(correct, incorrect) {
  const options = incorrect.slice();
  options.push(correct);
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  // ensure uniqueness again and keep correct present
  const seen = new Set();
  const uniq = [];
  for (const o of options) {
    const key = (o || '').toString();
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(key);
    }
  }
  // if for some reason we lost items, fill until 4 with placeholders
  while (uniq.length < 4) uniq.push('None of the above');
  const correctIndex = uniq.findIndex(x => x === correct);
  return { options: uniq, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
}

function speedXPByTime(seconds) {
  if (seconds <= 5) return 10;
  if (seconds <= 10) return 7;
  if (seconds <= 20) return 5;
  return 3;
}

function difficultyBonus(difficulty) {
  if (!difficulty) return 10;
  const map = { easy: 5, medium: 10, hard: 15 };
  return map[difficulty.toLowerCase()] || 10;
}

function formatQuestionEmbed(q, timeLeft) {
  // Clean daily-quiz UI using allowed emojis and Info color
  const descParts = [];
  if (typeof timeLeft === 'number') descParts.push(`⏳ Time: ${timeLeft}s`);
  descParts.push('Answer quickly to earn more XP');
  descParts.push('');
  descParts.push(q.question);

  const embed = new EmbedBuilder()
    .setTitle('🧠 Daily Quiz')
    .setDescription(descParts.join('\n'))
    .setColor(0x0099FF)
    .addFields({ name: 'Difficulty', value: (q.difficulty || 'medium').toString(), inline: true });

  embed.setFooter({ text: 'Choose the correct answer below' });
  if (typeof timeLeft === 'number') embed.setTimestamp();
  return embed;
}

// startQuiz: sends a quiz to a channel, handles collection, scoring, and awarding XP
async function startQuiz(channel, client, seconds = parseInt(process.env.QUIZ_TIME_SECONDS || '30')) {
  if (activeQuiz) return null; // only one active quiz globally
  const qRaw = await getQuestion();
  if (!qRaw) return null;

  // normalize question structure
  const q = {
    question: qRaw.question,
    difficulty: qRaw.difficulty || 'medium'
  };
  const { options, correctIndex } = shuffleOptions(qRaw.correct, qRaw.incorrect || qRaw.choices || []);

  const embed = formatQuestionEmbed({ question: q.question, difficulty: q.difficulty }, seconds);
  console.log('Quiz started:', q.question);

  const row = new ActionRowBuilder();
  for (let i = 0; i < options.length; i++) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`quiz_${i}`).setLabel(options[i].slice(0, 80)).setStyle(ButtonStyle.Primary)
    );
  }

  // Post the quiz embed (mass-style spacing handled by embed description)
  const msg = await channel.send({ embeds: [embed], components: [row] });

  // countdown
  let timeLeft = seconds;
  const startTime = Date.now();
  const countdown = setInterval(async () => {
    try {
      timeLeft -= 1;
      const e = formatQuestionEmbed({ question: q.question, difficulty: q.difficulty }, Math.max(0, timeLeft));
      await msg.edit({ embeds: [e] });
      if (timeLeft <= 0) clearInterval(countdown);
    } catch (e) { clearInterval(countdown); }
  }, 1000);

  const responses = {}; // userId -> { index, time }

  const collector = msg.createMessageComponentCollector({ componentType: 2, time: (seconds + 1) * 1000 });

  collector.on('collect', async (interaction) => {
    try {
      const uid = interaction.user.id;
      if (responses[uid]) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription('⚠️ You have already answered this quiz.')], ephemeral: true });
        return;
      }
      const idx = parseInt(interaction.customId.split('_')[1], 10);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      responses[uid] = { index: idx, time: elapsed };
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00AE86).setDescription(`✅ Answer recorded: ${String.fromCharCode(65 + idx)}`)], ephemeral: true });
      console.log('Answer received from', uid, 'index', idx);
    } catch (e) {
      try { await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription('⚠️ Error recording answer')], ephemeral: true }); } catch (er) {}
    }
  });

  collector.on('end', async () => {
    console.log('Quiz ended for question:', q.question);
    clearInterval(countdown);
    // disable buttons
    try {
      const disabledRow = new ActionRowBuilder();
      for (let i = 0; i < options.length; i++) {
        disabledRow.addComponents(new ButtonBuilder().setCustomId(`quiz_${i}`).setLabel(options[i].slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(true));
      }
      await msg.edit({ components: [disabledRow] });
    } catch (e) {}

    // compute winners
    const winners = [];
    for (const [uid, r] of Object.entries(responses)) {
      if (r.index === correctIndex) winners.push({ id: uid, time: r.time });
    }
    winners.sort((a, b) => a.time - b.time);

      const resultEmbed = new EmbedBuilder()
        .setTitle('🧠 Quiz Results')
        .setColor(0x00AE86)
        .addFields({ name: 'Question', value: q.question })
        .addFields({ name: 'Correct Answer', value: options[correctIndex] })
        .setDescription('Well played — winners earn speed + difficulty bonuses.')
        .setTimestamp();

    if (winners.length === 0) {
      resultEmbed.addFields({ name: 'Winners', value: 'No one answered correctly this time — try again!' });
    } else {
      const top = winners.slice(0, 10).map((w, i) => `#${i + 1} <@${w.id}> — ${w.time}s`).join('\n');
      resultEmbed.addFields({ name: 'Winners', value: top });
    }

    await channel.send({ embeds: [resultEmbed] });

    // award fixed base quest points for correct answers
    for (const w of winners) {
      await ensureUser(w.id);
      const data = await readData();
      const user = data.users[w.id] || {};
      user.questPoints = (user.questPoints || 0) + QUIZ_BASE_POINTS;
      await updateUser(w.id, { questPoints: user.questPoints });
    }

    activeQuiz = null;
  });

  activeQuiz = { question: q, message: msg, startedAt: Date.now(), responses, seconds };
  return activeQuiz;
}

function getActiveQuiz() {
  return activeQuiz;
}

let dailyJobsStarted = false;
function startDailyJobs(client) {
  if (dailyJobsStarted) return;
  dailyJobsStarted = true;
  // morning motivation
  console.log('quizManager: startDailyJobs initializing');
  cron.schedule(process.env.CRON_MORNING || '0 8 * * *', async () => {
    try {
      const data = await readData();
      for (const guildId of Object.keys(data.guilds || {})) {
        const g = data.guilds[guildId];
        if (!g.questChannel) continue;
        const ch = await client.channels.fetch(g.questChannel).catch(() => null);
        if (ch) {
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setDescription(['💬 **Hey everyone! Hope you\'re doing great**', '', '📌 Small steps win races — one short study session today can make a big difference.', '', '🔥 Keep pushing forward — small steps matter!'].join('\n'))
            .setTimestamp();
          await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
        }
      }
    } catch (e) {}
  });

  // quiz time
  cron.schedule(process.env.CRON_QUIZ || '0 12 * * *', async () => {
    try {
      const data = await readData();
      for (const guildId of Object.keys(data.guilds || {})) {
        const g = data.guilds[guildId];
        if (!g.questChannel) continue;
        const ch = await client.channels.fetch(g.questChannel).catch(() => null);
        if (ch) await startQuiz(ch, client);
      }
    } catch (e) { console.error(e); }
  });

  // evening reminder
  cron.schedule(process.env.CRON_EVENING || '0 18 * * *', async () => {
    try {
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
    } catch (e) {}
  });

  // night leaderboard
  cron.schedule(process.env.CRON_NIGHT || '0 22 * * *', async () => {
    try {
      const data = await readData();
      for (const guildId of Object.keys(data.guilds || {})) {
        const g = data.guilds[guildId];
        if (!g.questChannel) continue;
        const ch = await client.channels.fetch(g.questChannel).catch(() => null);
        if (!ch) continue;
        const users = Object.entries(data.users || {}).map(([id, u]) => ({ id, progressPoints: u.progressPoints || 0 }));
        users.sort((a, b) => b.progressPoints - a.progressPoints);
        const lines = users.slice(0, 5).map((u, i) => {
          if (i === 0) return `🥇 1. <@${u.id}> — ${u.progressPoints} pts`;
          if (i === 1) return `🥈 2. <@${u.id}> — ${u.progressPoints} pts`;
          if (i === 2) return `🥉 3. <@${u.id}> — ${u.progressPoints} pts`;
          return `${i + 1}. <@${u.id}> — ${u.progressPoints} pts`;
        }).join('\n') || 'No users yet.';
        const embed = new EmbedBuilder()
          .setTitle('🏆 Daily Top')
          .setDescription(lines)
          .setColor(0xFFD700)
          .setFooter({ text: 'Keep grinding 🔥' })
          .setTimestamp();
        await ch.send({ embeds: [embed] });
      }
    } catch (e) { console.error(e); }
  });
}

module.exports = { startQuiz, startDailyJobs, getActiveQuiz, getQuizFromAPI, getFallbackQuiz, shuffleOptions, decodeHTML, sendQuiz };

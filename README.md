# CyberBot — Gamified Learning Discord Bot

A modular Discord bot built with Node.js and discord.js v14. Features progress tracking, daily quizzes, AI mentor, achievements, and scheduled jobs.

Quick start

1. Copy `.env.example` to `.env` and fill in values.
2. Install deps:

```bash
npm install
```

3. Register commands (optional during development):

```bash
npm run deploy-commands
```

4. Start bot:

```bash
npm start
```

Files

- `index.js` — main entry
- `deploy-commands.js` — registers slash commands
- `commands/` — slash commands (`/points`, `/leaderboard`, `/setprogress`, `/setquest`, `/setai`, `/ask`)
- `events/` — event handlers (`ready`, `interactionCreate`, `messageCreate`)
- `utils/` — helpers (data store, quiz manager, xp, achievements)
- `data.json` — JSON database
- `questions.json` — sample local question bank

Notes

- Use `.env` to configure times and keys. The cron schedules default to morning/quiz/evening/night times.
- Data is stored in `data.json`; ensure bot process has write access.
- The quiz uses buttons and a live countdown (message edits). Only one active quiz per process.

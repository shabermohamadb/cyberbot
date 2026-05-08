require('dotenv').config();
// Single-instance guard within this Node process
if (global.BOT_RUNNING) {
  console.log('Bot already running in this process, exiting duplicate instance');
  process.exit(0);
}
global.BOT_RUNNING = true;
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const cron = require('node-cron');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Global send dedupe: prevent accidental duplicate sends across the bot
global.SEND_CACHE = global.SEND_CACHE || new Map();
const { TextChannel, DMChannel, ThreadChannel, NewsChannel, Message } = require('discord.js');
const wrapSend = (klass) => {
  if (!klass || !klass.prototype) return;
  if (klass.prototype.__send_wrapped) return;
  const orig = klass.prototype.send;
  klass.prototype.send = async function(...args) {
    try {
      const channelId = this.id || 'unknown';
      let key;
      try { key = channelId + '|' + JSON.stringify(args[0]); } catch (e) { key = channelId + '|' + String(Date.now()); }
      const now = Date.now();
      const prev = global.SEND_CACHE.get(key);
      if (prev && now - prev < 2000) {
        console.log('Skipped duplicate send to', channelId);
        return null;
      }
      global.SEND_CACHE.set(key, now);
      setTimeout(() => global.SEND_CACHE.delete(key), 3000);
      return await orig.apply(this, args);
    } catch (e) {
      return orig.apply(this, args);
    }
  };
  klass.prototype.__send_wrapped = true;
};
wrapSend(TextChannel);
wrapSend(DMChannel);
wrapSend(ThreadChannel);
wrapSend(NewsChannel);

// also wrap Message.reply to avoid duplicate replies
try {
  if (Message && Message.prototype && !Message.prototype.__reply_wrapped) {
    const origReply = Message.prototype.reply;
    Message.prototype.reply = async function(...args) {
      try {
        const channelId = this.channel && (this.channel.id || 'unknown');
        let key;
        try { key = 'reply|' + (this.id || '') + '|' + JSON.stringify(args[0]); } catch (e) { key = 'reply|' + (this.id || '') + '|' + String(Date.now()); }
        const now = Date.now();
        const prev = global.SEND_CACHE.get(key);
        if (prev && now - prev < 2000) {
          console.log('Skipped duplicate reply for', this.id);
          return null;
        }
        global.SEND_CACHE.set(key, now);
        setTimeout(() => global.SEND_CACHE.delete(key), 3000);
        return await origReply.apply(this, args);
      } catch (e) {
        return origReply.apply(this, args);
      }
    };
    Message.prototype.__reply_wrapped = true;
  }
} catch (e) {}

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
  }
}

// load events (guarded so we don't register twice)
const eventsPath = path.join(__dirname, 'events');
if (!global.EVENTS_BOUND) {
  global.EVENTS_BOUND = true;
  if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
      const ev = require(path.join(eventsPath, file));
      if (ev.once) client.once(ev.name, (...args) => ev.execute(...args, client));
      else client.on(ev.name, (...args) => ev.execute(...args, client));
    }
  }
} else {
  console.log('Events already bound, skipping event registration');
}

// global handlers to avoid crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection', err);
});

// Cron jobs are started after the client is ready (see events/ready.js)

client.login(process.env.DISCORD_TOKEN);

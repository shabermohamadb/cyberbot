require('dotenv').config();
// Single-instance guard within this Node process
if (global.BOT_RUNNING) {
  console.log('Bot already running in this process, exiting duplicate instance');
  process.exit(0);
}
global.BOT_RUNNING = true;
// PID lock file to avoid multiple node processes running the bot (helps prevent duplicate cron sends)
const fs = require('fs');
const PID_LOCK = path.join(__dirname, '.bot.pid');
try {
  try {
    const fd = fs.openSync(PID_LOCK, 'wx');
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, started: Date.now() }));
    fs.closeSync(fd);
  } catch (e) {
    try {
      const raw = fs.readFileSync(PID_LOCK, 'utf-8');
      const obj = JSON.parse(raw || '{}');
      const age = Date.now() - (obj.started || 0);
      // if existing lock is older than 5 minutes assume stale
      if (age < 5 * 60 * 1000) {
        console.error('Another bot process appears to be running (lock file present). Exiting to avoid duplicates.');
        process.exit(1);
      } else {
        console.log('Stale PID lock found, overriding.');
        fs.unlinkSync(PID_LOCK);
        const fd = fs.openSync(PID_LOCK, 'wx');
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, started: Date.now() }));
        fs.closeSync(fd);
      }
    } catch (er) {
      console.warn('Failed to read or override PID lock, continuing anyway.', er && er.message);
    }
  }
  const cleanup = () => { try { fs.unlinkSync(PID_LOCK); } catch (e) {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
} catch (e) { console.warn('PID lock handling failed', e && e.message); }
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
// Global sending guard to prevent duplicate sends across the bot
global.SENDING = typeof global.SENDING === 'boolean' ? global.SENDING : false;

const { TextChannel, DMChannel, ThreadChannel, NewsChannel, Message, Interaction } = require('discord.js');
// Normalize send/reply args into a stable string to key dedupe cache
function makeDedupeKey(prefix, arg) {
  try {
    if (typeof arg === 'string') return `${prefix}|${arg}`;
    if (!arg) return `${prefix}|<no-args>`;
    if (typeof arg === 'object') {
      if (arg.content) return `${prefix}|${String(arg.content)}`;
      if (arg.embeds && arg.embeds.length) {
        const eb = Array.isArray(arg.embeds) ? arg.embeds[0] : arg.embeds;
        try {
          if (eb && typeof eb.toJSON === 'function') return `${prefix}|${JSON.stringify(eb.toJSON())}`;
          return `${prefix}|${JSON.stringify(eb)}`;
        } catch (e) { /* fallthrough */ }
      }
      if (arg.files) return `${prefix}|files`;
      try { return `${prefix}|${JSON.stringify(arg)}`; } catch (e) { return `${prefix}|<obj>`; }
    }
    return `${prefix}|${String(arg)}`;
  } catch (e) {
    return `${prefix}|<err>`;
  }
}
const wrapSend = (klass) => {
  if (!klass || !klass.prototype) return;
  if (klass.prototype.__send_wrapped) return;
  const orig = klass.prototype.send;
  klass.prototype.send = async function(...args) {
    try {
      if (global.SENDING) {
        console.log('global.SENDING active, skip send for channel', this.id || 'unknown');
        return null;
      }
      global.SENDING = true;
      const channelId = this.id || 'unknown';
      // create a stable key for deduping
      let key = makeDedupeKey(channelId, args[0]);
      const now = Date.now();
      const prev = global.SEND_CACHE.get(key);
      if (prev && now - prev < 2000) {
        console.log('Skipped duplicate send to', channelId, 'key=', key);
        return null;
      }
      global.SEND_CACHE.set(key, now);
      setTimeout(() => global.SEND_CACHE.delete(key), 3000);
      return await orig.apply(this, args);
    } catch (e) {
      return orig.apply(this, args);
    } finally {
      setTimeout(() => { try { global.SENDING = false; } catch (e) {} }, 1000);
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
        if (global.SENDING) {
          console.log('global.SENDING active, skip reply for message', this.id || 'unknown');
          return null;
        }
        global.SENDING = true;
        const channelId = this.channel && (this.channel.id || 'unknown');
        const key = makeDedupeKey('reply|' + (this.id || ''), args[0]);
        const now = Date.now();
        const prev = global.SEND_CACHE.get(key);
        if (prev && now - prev < 2000) {
          console.log('Skipped duplicate reply for', this.id, 'channel=', channelId, 'key=', key);
          return null;
        }
        global.SEND_CACHE.set(key, now);
        setTimeout(() => global.SEND_CACHE.delete(key), 3000);
        return await origReply.apply(this, args);
      } catch (e) {
        return origReply.apply(this, args);
      } finally {
        setTimeout(() => { try { global.SENDING = false; } catch (e) {} }, 1000);
      }
    };
    Message.prototype.__reply_wrapped = true;
  }
} catch (e) {}

// Wrap Interaction.reply/followUp/editReply to avoid duplicate responses
try {
  if (Interaction && Interaction.prototype && !Interaction.prototype.__reply_wrapped) {
    const origReplyI = Interaction.prototype.reply;
    Interaction.prototype.reply = async function(...args) {
      try {
        if (global.SENDING) {
          console.log('global.SENDING active, skip interaction.reply for', this.id || 'unknown');
          return null;
        }
        global.SENDING = true;
        const key = makeDedupeKey('interactionReply|' + (this.id || ''), args[0]);
        const now = Date.now();
        const prev = global.SEND_CACHE.get(key);
        if (prev && now - prev < 2000) {
          console.log('Skipped duplicate interaction.reply for', this.id, 'key=', key);
          return null;
        }
        global.SEND_CACHE.set(key, now);
        setTimeout(() => global.SEND_CACHE.delete(key), 3000);
        return await origReplyI.apply(this, args);
      } catch (e) {
        return origReplyI.apply(this, args);
      } finally {
        setTimeout(() => { try { global.SENDING = false; } catch (e) {} }, 1000);
      }
    };
    const origFollow = Interaction.prototype.followUp;
    Interaction.prototype.followUp = async function(...args) {
      try {
        if (global.SENDING) {
          console.log('global.SENDING active, skip interaction.followUp for', this.id || 'unknown');
          return null;
        }
        global.SENDING = true;
        const key = makeDedupeKey('interactionFollow|' + (this.id || ''), args[0]);
        const now = Date.now();
        const prev = global.SEND_CACHE.get(key);
        if (prev && now - prev < 2000) {
          console.log('Skipped duplicate interaction.followUp for', this.id, 'key=', key);
          return null;
        }
        global.SEND_CACHE.set(key, now);
        setTimeout(() => global.SEND_CACHE.delete(key), 3000);
        return await origFollow.apply(this, args);
      } catch (e) {
        return origFollow.apply(this, args);
      } finally {
        setTimeout(() => { try { global.SENDING = false; } catch (e) {} }, 1000);
      }
    };
    const origEdit = Interaction.prototype.editReply;
    Interaction.prototype.editReply = async function(...args) {
      try {
        if (global.SENDING) {
          console.log('global.SENDING active, skip interaction.editReply for', this.id || 'unknown');
          return null;
        }
        global.SENDING = true;
        const key = makeDedupeKey('interactionEdit|' + (this.id || ''), args[0]);
        const now = Date.now();
        const prev = global.SEND_CACHE.get(key);
        if (prev && now - prev < 2000) {
          console.log('Skipped duplicate interaction.editReply for', this.id, 'key=', key);
          return null;
        }
        global.SEND_CACHE.set(key, now);
        setTimeout(() => global.SEND_CACHE.delete(key), 3000);
        return await origEdit.apply(this, args);
      } catch (e) {
        return origEdit.apply(this, args);
      } finally {
        setTimeout(() => { try { global.SENDING = false; } catch (e) {} }, 1000);
      }
    };
    Interaction.prototype.__reply_wrapped = true;
  }
} catch (e) { console.warn('Interaction wrap failed', e && e.message); }

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

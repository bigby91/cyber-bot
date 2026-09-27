const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

const MAX_EVENTS = 100;
let botInstance = null;

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, '[]');
  }
}

function readEvents() {
  ensureStore();

  try {
    const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeEvents(events) {
  ensureStore();

  fs.writeFileSync(
    EVENTS_FILE,
    JSON.stringify(events.slice(-MAX_EVENTS), null, 2)
  );
}

function initEvents(bot) {
  botInstance = bot;
  ensureStore();
}

function recordEvent(type, message, options = {}) {
  const event = {
    id: Date.now(),
    time: new Date().toISOString(),
    type,
    message: String(message).slice(0, 1000),
    severity: options.severity || 'info'
  };

  const events = readEvents();
  events.push(event);
  writeEvents(events);

  // Send important events to owner.
  if (
    botInstance &&
    options.alert === true &&
    process.env.ADMIN_USER_IDS
  ) {
    const owners = String(process.env.ADMIN_USER_IDS)
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '🔴',
      critical: '🚨'
    }[event.severity] || 'ℹ️';

    const text =
      `${emoji} *BOT ALERT*\n\n` +
      `*Type:* ${event.type}\n` +
      `*Time:* ${event.time}\n` +
      `*Event:* ${event.message}`;

    for (const ownerId of owners) {
      botInstance.telegram
        .sendMessage(ownerId, text, { parse_mode: 'Markdown' })
        .catch(() => {});
    }
  }

  return event;
}

function registerEvents(bot) {
  bot.command('events', async (ctx) => {
    const owners = String(process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    if (!owners.includes(String(ctx.from?.id))) {
      return ctx.reply('⛔ This command is restricted to the bot owner.');
    }

    const events = readEvents().slice(-15).reverse();

    if (!events.length) {
      return ctx.reply('📭 No events recorded yet.');
    }

    const lines = [
      '🚨 *RECENT BOT EVENTS*',
      ''
    ];

    for (const event of events) {
      const emoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '🔴',
        critical: '🚨'
      }[event.severity] || 'ℹ️';

      const time = new Date(event.time).toLocaleString();

      lines.push(
        `${emoji} *${event.type}*`,
        `${time}`,
        `${event.message}`,
        ''
      );
    }

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown'
    });
  });
}

module.exports = {
  initEvents,
  recordEvent,
  registerEvents
};

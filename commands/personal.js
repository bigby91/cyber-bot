const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(BOT_ROOT, 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function genId() {
  return crypto.randomBytes(3).toString('hex');
}

function getArgs(ctx) {
  const text = ctx.message.text || '';
  const spaceIdx = text.indexOf(' ');
  return spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();
}

function parseDueDate(spec) {
  const now = new Date();

  const relMatch = spec.match(/^(\d+)([smhd])$/i);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const multiplier = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
    return new Date(now.getTime() + amount * multiplier);
  }

  const tomorrowMatch = spec.match(/^tomorrow(?:\s+(\d{1,2}):(\d{2}))?$/i);
  if (tomorrowMatch) {
    const hh = tomorrowMatch[1] ? parseInt(tomorrowMatch[1], 10) : 9;
    const mm = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;
    if (hh > 23 || mm > 59) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  const timeMatch = spec.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hh = parseInt(timeMatch[1], 10);
    const mm = parseInt(timeMatch[2], 10);
    if (hh > 23 || mm > 59) return null;
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }

  return null;
}

function extractSpec(argsText) {
  let m = argsText.match(/^tomorrow\s+(\d{1,2}:\d{2})\s+(.+)$/i);
  if (m) return { spec: `tomorrow ${m[1]}`, text: m[2] };

  m = argsText.match(/^tomorrow\s+(.+)$/i);
  if (m) return { spec: 'tomorrow', text: m[1] };

  m = argsText.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
  if (m) return { spec: m[1], text: m[2] };

  m = argsText.match(/^(\d+[smhd])\s+(.+)$/i);
  if (m) return { spec: m[1], text: m[2] };

  return null;
}

function getChatReminders(chatId) {
  return loadJson(REMINDERS_FILE)
    .filter((r) => r.chatId === chatId)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function checkAndFireReminders(bot) {
  const reminders = loadJson(REMINDERS_FILE);
  const now = Date.now();
  const due = reminders.filter((r) => new Date(r.dueAt).getTime() <= now);
  if (!due.length) return 0;
  const remaining = reminders.filter((r) => new Date(r.dueAt).getTime() > now);
  saveJson(REMINDERS_FILE, remaining);
  due.forEach((r) => {
    bot.telegram.sendMessage(r.chatId, `⏰ Reminder: ${r.text}`).catch((err) => {
      console.error('[reminders] send failed:', err.message);
    });
  });
  return due.length;
}

function getChatNotes(chatId) {
  return loadJson(NOTES_FILE).filter((n) => n.chatId === chatId);
}

function registerPersonal(bot) {
  ensureDataDir();

  bot.command('remind', (ctx) => {
    const args = getArgs(ctx);
    if (!args) {
      return ctx.reply('Usage: /remind 30m drink water\nor: /remind tomorrow 09:00 meeting\nor: /remind 18:30 call mom');
    }
    const extracted = extractSpec(args);
    if (!extracted) {
      return ctx.reply("Couldn't parse that. Try: /remind 30m drink water  or  /remind tomorrow 09:00 meeting");
    }
    const dueDate = parseDueDate(extracted.spec);
    if (!dueDate) {
      return ctx.reply("Couldn't parse the time. Use Nm/Nh/Nd, HH:MM, or 'tomorrow HH:MM'.");
    }
    const reminders = loadJson(REMINDERS_FILE);
    const reminder = {
      id: genId(),
      chatId: ctx.chat.id,
      text: extracted.text,
      dueAt: dueDate.toISOString(),
      createdAt: new Date().toISOString(),
    };
    reminders.push(reminder);
    saveJson(REMINDERS_FILE, reminders);
    ctx.reply(`⏰ Reminder set for ${dueDate.toLocaleString()} — "${reminder.text}"`);
  });

  bot.command('reminders', (ctx) => {
    const mine = getChatReminders(ctx.chat.id);
    if (!mine.length) return ctx.reply('No active reminders. Add one with /remind 30m walk the dog');
    const lines = mine.map((r, i) => `${i + 1}. ${new Date(r.dueAt).toLocaleString()} — ${r.text}`);
    ctx.reply(lines.join('\n'));
  });

  bot.command('unremind', (ctx) => {
    const pos = parseInt(getArgs(ctx), 10);
    if (!pos || pos < 1) return ctx.reply('Usage: /unremind <number>  (see /reminders for numbers)');
    const mine = getChatReminders(ctx.chat.id);
    const target = mine[pos - 1];
    if (!target) return ctx.reply(`No reminder #${pos}. Check /reminders.`);
    const all = loadJson(REMINDERS_FILE);
    const idx = all.findIndex((r) => r.id === target.id);
    if (idx !== -1) all.splice(idx, 1);
    saveJson(REMINDERS_FILE, all);
    ctx.reply(`🗑️ Cancelled: ${target.text}`);
  });

  setInterval(() => checkAndFireReminders(bot), 30 * 1000);

  bot.command('note', (ctx) => {
    const text = getArgs(ctx);
    if (!text) return ctx.reply('Usage: /note buy groceries');
    const notes = loadJson(NOTES_FILE);
    notes.push({ id: genId(), chatId: ctx.chat.id, text, createdAt: new Date().toISOString() });
    saveJson(NOTES_FILE, notes);
    ctx.reply('📝 Noted.');
  });

  bot.command('notes', (ctx) => {
    const mine = getChatNotes(ctx.chat.id);
    if (!mine.length) return ctx.reply('No notes yet. Add one with /note your idea here');
    const lines = mine.map((n, i) => `${i + 1}. ${n.text}`);
    ctx.reply(lines.join('\n'));
  });

  bot.command('forget', (ctx) => {
    const pos = parseInt(getArgs(ctx), 10);
    if (!pos || pos < 1) return ctx.reply('Usage: /forget <number>  (see /notes for numbers)');
    const mine = getChatNotes(ctx.chat.id);
    const target = mine[pos - 1];
    if (!target) return ctx.reply(`No note #${pos}. Check /notes.`);
    const all = loadJson(NOTES_FILE);
    const idx = all.findIndex((n) => n.id === target.id);
    if (idx !== -1) all.splice(idx, 1);
    saveJson(NOTES_FILE, all);
    ctx.reply(`🗑️ Forgotten: ${target.text}`);
  });

  bot.command('todo', (ctx) => {
    const args = getArgs(ctx);
    const spaceIdx = args.indexOf(' ');
    const sub = (spaceIdx === -1 ? args : args.slice(0, spaceIdx)).toLowerCase();
    const rest = spaceIdx === -1 ? '' : args.slice(spaceIdx + 1).trim();
    const todos = loadJson(TODOS_FILE);

    if (sub === 'add') {
      if (!rest) return ctx.reply('Usage: /todo add finish website');
      todos.push({ id: genId(), chatId: ctx.chat.id, text: rest, done: false, createdAt: new Date().toISOString() });
      saveJson(TODOS_FILE, todos);
      return ctx.reply(`✅ Added: ${rest}`);
    }

    if (sub === 'list' || !sub) {
      const mine = todos.filter((t) => t.chatId === ctx.chat.id);
      if (!mine.length) return ctx.reply('No todos yet. Add one with /todo add <task>');
      const lines = mine.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${t.text}`);
      return ctx.reply(lines.join('\n'));
    }

    if (sub === 'done') {
      const pos = parseInt(rest, 10);
      const mine = todos.filter((t) => t.chatId === ctx.chat.id);
      const target = mine[pos - 1];
      if (!pos || !target) return ctx.reply('Usage: /todo done <number>  (see /todo list for numbers)');
      target.done = true;
      saveJson(TODOS_FILE, todos);
      return ctx.reply(`✅ Marked done: ${target.text}`);
    }

    if (sub === 'remove') {
      const pos = parseInt(rest, 10);
      const mine = todos.filter((t) => t.chatId === ctx.chat.id);
      const target = mine[pos - 1];
      if (!pos || !target) return ctx.reply('Usage: /todo remove <number>');
      const idx = todos.findIndex((t) => t.id === target.id);
      todos.splice(idx, 1);
      saveJson(TODOS_FILE, todos);
      return ctx.reply(`🗑️ Removed: ${target.text}`);
    }

    return ctx.reply('Usage: /todo add <task> | /todo list | /todo done <n> | /todo remove <n>');
  });
}

module.exports = { registerPersonal, parseDueDate, extractSpec, checkAndFireReminders };

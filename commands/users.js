const { adminOnly } = require('./admin');
const fs = require('fs');
const path = require('path');

const BOT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(BOT_ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'user_activity.json');

const ACTIVE_NOW_MS = 60 * 1000;
const ACTIVE_24H_MS = 24 * 60 * 60 * 1000;
const ACTIVE_7D_MS = 7 * 24 * 60 * 60 * 1000;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: {}, chats: {} };
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    return {
      users: data.users || {},
      chats: data.chats || {},
    };
  } catch (err) {
    console.error('[users] failed to load data:', err);
    return { users: {}, chats: {} };
  }
}

function saveData(data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (err) {
    console.error('[users] failed to save data:', err);
  }
}

const data = loadData();

function trackActivity(ctx) {
  const user = ctx.from;
  const chat = ctx.chat;

  if (!user || !chat) return;

  const now = Date.now();
  const userId = String(user.id);
  const chatId = String(chat.id);

  if (!data.users[userId]) {
    data.users[userId] = {
      id: user.id,
      username: user.username || null,
      firstName: user.first_name || null,
      lastSeen: now,
      firstSeen: now,
      messages: 0,
    };
  }

  const record = data.users[userId];

  record.username = user.username || record.username || null;
  record.firstName = user.first_name || record.firstName || null;
  record.lastSeen = now;
  record.messages = (record.messages || 0) + 1;

  if (!data.chats[chatId]) {
    data.chats[chatId] = {
      id: chat.id,
      type: chat.type,
      title: chat.title || null,
      lastSeen: now,
      messages: 0,
    };
  }

  const chatRecord = data.chats[chatId];

  chatRecord.type = chat.type;
  chatRecord.title = chat.title || chatRecord.title || null;
  chatRecord.lastSeen = now;
  chatRecord.messages = (chatRecord.messages || 0) + 1;

  // Don't write the file on every message.
  // Flush periodically instead.
  scheduleSave();
}

let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveData(data);
  }, 2000);
}

function formatAge(timestamp) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}

function getStats() {
  const now = Date.now();

  const users = Object.values(data.users);

  const activeNow = users.filter(
    u => now - u.lastSeen <= ACTIVE_NOW_MS
  );

  const active24h = users.filter(
    u => now - u.lastSeen <= ACTIVE_24H_MS
  );

  const active7d = users.filter(
    u => now - u.lastSeen <= ACTIVE_7D_MS
  );

  const chats = Object.values(data.chats);

  const privateChats = chats.filter(
    c => c.type === 'private'
  );

  const groupChats = chats.filter(
    c =>
      c.type === 'group' ||
      c.type === 'supergroup'
  );

  return {
    totalUsers: users.length,
    activeNow,
    active24h,
    active7d,
    totalChats: chats.length,
    privateChats,
    groupChats,
  };
}

function isAdmin(ctx) {
  const adminIds = String(
    process.env.ADMIN_USER_IDS || ''
  )
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  return adminIds.includes(String(ctx.from?.id));
}

function buildUsersMessage() {
  const stats = getStats();

  const recent = [...stats.activeNow]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 10);

  const lines = [
    '👥 *CYBER-BOT USERS*',
    '━━━━━━━━━━━━━━━━━━',
    '',
    `👤 Total users: *${stats.totalUsers}*`,
    `🟢 Active now: *${stats.activeNow.length}*`,
    `🔥 Active 24h: *${stats.active24h.length}*`,
    `📅 Active 7d: *${stats.active7d.length}*`,
    '',
    `💬 Total chats: *${stats.totalChats}*`,
    `👤 Private chats: *${stats.privateChats.length}*`,
    `👥 Groups: *${stats.groupChats.length}*`,
  ];

  if (recent.length) {
    lines.push('');
    lines.push('⚡ *ACTIVE RIGHT NOW*');

    for (const user of recent) {
      const name = user.username
        ? `@${user.username}`
        : user.firstName || `ID ${user.id}`;

      lines.push(`• ${name} — ${formatAge(user.lastSeen)}`);
    }
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push(`🕐 ${new Date().toISOString()}`);

  return lines.join('\n');
}

function registerUsers(bot) {
  const originalCommand = bot.command;
  bot.command = function(command, ...handlers) {
    return originalCommand.call(this, command, ...handlers.map(h => adminOnly(h)));
  };
  // Track every incoming message/update that reaches the bot.
  bot.use(async (ctx, next) => {
    try {
      trackActivity(ctx);
    } catch (err) {
      console.error('[users] tracking error:', err);
    }

    return next();
  });

  bot.command('users', async ctx => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ This command is admin-only.');
    }

    try {
      await ctx.reply(buildUsersMessage(), {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.error('[users] command error:', err);
      await ctx.reply('❌ Failed to generate user statistics.');
    }
  });
}

module.exports = {
  registerUsers,
  trackActivity,
  buildUsersMessage,
};

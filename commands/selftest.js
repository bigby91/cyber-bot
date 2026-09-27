const fs = require('fs');
const path = require('path');
const os = require('os');
const { isAdmin } = require('./admin');

const ROOT = path.join(__dirname, '..');

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function check(name, ok, detail = '') {
  return `${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`;
}

function registerSelfTest(bot) {
  bot.command('selftest', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ This command is restricted to the bot owner.');
    }

    const lines = [];

    lines.push('🧪 *BOT SELF-TEST*');
    lines.push('');

    // Core files
    lines.push('*Core*');
    lines.push(check('bot.js', exists('bot.js')));
    lines.push(check('.env', exists('.env')));
    lines.push(check('conversations.log', exists('conversations.log')));
    lines.push('');

    // Commands
    lines.push('*Command modules*');
    for (const file of [
      'commands/admin.js',
      'commands/devtools.js',
      'commands/status.js',
      'commands/users.js',
      'commands/selftest.js'
    ]) {
      lines.push(check(file, exists(file)));
    }
    lines.push('');

    // AI provider configuration
    lines.push('*AI configuration*');

    const provider = String(process.env.AI_PROVIDER || 'groq').toLowerCase();

    const keys = {
      groq: !!process.env.GROQ_API_KEY,
      mistral: !!process.env.MISTRAL_API_KEY,
      claude: !!process.env.CLAUDE_API_KEY
    };

    const models = {
      groq: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      mistral: process.env.MISTRAL_MODEL || 'mistral-medium-latest',
      claude: process.env.CLAUDE_MODEL || 'claude-opus-4-20250514'
    };

    lines.push(check(
      `Primary provider: ${provider}`,
      !!keys[provider],
      keys[provider] ? models[provider] : 'API key missing'
    ));

    const fallback = {
      groq: 'mistral',
      mistral: 'groq',
      claude: 'groq'
    }[provider];

    if (fallback) {
      lines.push(check(
        `Fallback provider: ${fallback}`,
        !!keys[fallback],
        keys[fallback] ? models[fallback] : 'API key missing'
      ));
    }

    lines.push('');

    // Runtime
    lines.push('*Runtime*');
    lines.push(check('Node.js', true, process.version));
    lines.push(check('PID', true, process.pid));
    lines.push(check('Platform', true, `${os.platform()} ${os.arch()}`));
    lines.push(check('Memory', true, `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB RSS`));

    lines.push('');

    // Admin
    lines.push('*Security*');
    lines.push(check(
      'Owner ID configured',
      !!process.env.ADMIN_USER_IDS
    ));

    lines.push('');

    // Overall
    const critical =
      !exists('bot.js') ||
      !exists('.env') ||
      !keys[provider] ||
      !process.env.ADMIN_USER_IDS;

    lines.push(
      critical
        ? '🔴 *SELF-TEST RESULT: PROBLEMS FOUND*'
        : '🟢 *SELF-TEST RESULT: PASS*'
    );

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown'
    });
  });
}

module.exports = { registerSelfTest };

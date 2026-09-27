const { adminOnly } = require('./admin');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { AI_PROVIDER } = require('../crons/config/providers');

const BOT_ROOT = path.join(__dirname, '..');

const PROVIDERS = {
  groq: { name: 'Groq', keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL', defaultModel: 'openai/gpt-oss-120b', fallback: 'mistral' },
  mistral: { name: 'Mistral', keyEnv: 'MISTRAL_API_KEY', modelEnv: 'MISTRAL_MODEL', defaultModel: 'mistral-medium-latest', fallback: 'groq' },
  claude: { name: 'Claude', keyEnv: 'CLAUDE_API_KEY', modelEnv: 'CLAUDE_MODEL', defaultModel: 'claude-opus-4-20250514', fallback: 'groq' },
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d && !h && !m) parts.push(`${s}s`);
  return parts.join(' ');
}

function readFileLines(filePath) {
  try { return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean); } catch { return []; }
}
function countLines(filePath) { const lines = readFileLines(filePath); return lines.length || null; }

function getStorage() {
  try {
    const out = execSync(`df -h "${BOT_ROOT}" | tail -1`, { encoding: 'utf8', timeout: 2000 });
    const parts = out.trim().split(/\s+/);
    return { total: parts[1] || null, used: parts[2] || null, free: parts[3] || null, percent: parts[4] || null };
  } catch { return null; }
}
function getBattery() {
  try {
    const out = execSync('termux-battery-status', { encoding: 'utf8', timeout: 2000 });
    const data = JSON.parse(out);
    return { percentage: data.percentage, status: data.status, temperature: data.temperature, plugged: data.plugged };
  } catch { return null; }
}
function getProvider(id) { return PROVIDERS[id] || null; }
function getProviderInfo(id) {
  const provider = getProvider(id);
  if (!provider) return { id, valid: false, name: 'Unknown', keySet: false, model: null };
  const key = process.env[provider.keyEnv];
  return { id, valid: true, name: provider.name, keyEnv: provider.keyEnv, keySet: Boolean(key), model: process.env[provider.modelEnv] || provider.defaultModel, fallback: provider.fallback };
}
function getProviderChain() {
  const primary = String(AI_PROVIDER || 'groq').toLowerCase();
  const provider = getProvider(primary);
  if (!provider) return { primary, valid: false, chain: [primary] };
  return { primary, valid: true, chain: [primary, provider.fallback] };
}
function getRecentErrors() {
  const logPath = path.join(BOT_ROOT, 'bot.log');
  const lines = readFileLines(logPath);
  return lines.filter(line => /error|fatal|exception|failed/i.test(line)).slice(-3);
}
function getMemoryInfo() {
  const memory = process.memoryUsage();
  return { rss: Math.round(memory.rss / 1024 / 1024), heapUsed: Math.round(memory.heapUsed / 1024 / 1024), heapTotal: Math.round(memory.heapTotal / 1024 / 1024), systemFree: Math.round(os.freemem() / 1024 / 1024), systemTotal: Math.round(os.totalmem() / 1024 / 1024) };
}
function buildStatus() {
  const storage = getStorage(); const battery = getBattery(); const memory = getMemoryInfo();
  const provider = getProviderInfo(AI_PROVIDER); const chain = getProviderChain();
  const conversationCount = countLines(path.join(BOT_ROOT, 'conversations.log'));
  const lines = [
    '🤖 *CYBER-BOT STATUS*', '━━━━━━━━━━━━━━━━━━',
    `🟢 Process: ONLINE`, `⏱️ Uptime: ${formatUptime(process.uptime())}`,
    `🧠 Process RAM: ${memory.rss} MB`, `💾 System RAM free: ${memory.systemFree} MB`,
    `⚙️ Load (1m): ${os.loadavg()[0].toFixed(2)}`,
    storage ? `📦 Storage: ${storage.free} free (${storage.percent} used)` : '📦 Storage: unavailable',
    battery ? `🔋 Battery: ${battery.percentage}% (${battery.status})` : '🔋 Battery: unavailable',
    '', '🧠 *AI ENGINE*', `Primary: \`${chain.primary}\``,
    chain.valid ? `Fallback: \`${chain.chain.join(' → ')}\`` : 'Fallback: ❌ invalid provider',
    provider.valid ? `Model: \`${provider.model}\`` : 'Model: ❌ unknown',
    `API key: ${provider.keySet ? '✅ configured' : '❌ missing'}`,
    '', `💬 Conversations logged: ${conversationCount ?? 'unavailable'}`,
    `🟢 Node: ${process.version}`, `🆔 PID: ${process.pid}`,
    '━━━━━━━━━━━━━━━━━━', `🕐 ${new Date().toISOString()}`,
  ];
  return lines.join('\n');
}
function buildHealth() {
  const checks = []; const chain = getProviderChain();
  checks.push(chain.valid ? `✅ AI_PROVIDER=${chain.primary}` : `❌ Invalid AI_PROVIDER="${chain.primary}"`);
  for (const providerId of chain.chain) {
    const info = getProviderInfo(providerId);
    if (!info.valid) { checks.push(`❌ Unknown provider: ${providerId}`); continue; }
    checks.push(`${info.keySet ? '✅' : '❌'} ${info.name} key: \`${info.keyEnv}\``);
    checks.push(`${info.keySet ? '🟢' : '🔴'} ${info.name} model: ${info.model}`);
  }
  const requiredFiles = ['bot.js', '.env', 'conversations.log', 'crons/utils/generate.js', 'crons/config/providers/index.js', 'crons/config/providers/groq.js', 'crons/config/providers/mistral.js', 'crons/config/providers/claude.js'];
  checks.push(''); checks.push('📁 *FILES*');
  for (const rel of requiredFiles) { const exists = fs.existsSync(path.join(BOT_ROOT, rel)); checks.push(`${exists ? '✅' : '❌'} ${rel}`); }
  const recentErrors = getRecentErrors();
  checks.push(''); checks.push('🧾 *LOG HEALTH*');
  if (!fs.existsSync(path.join(BOT_ROOT, 'bot.log'))) { checks.push('⚠️ bot.log not found'); }
  else if (!recentErrors.length) { checks.push('✅ No recent errors detected'); }
  else {
    checks.push(`⚠️ ${recentErrors.length} recent error(s)`);
    for (const error of recentErrors) { const clean = error.length > 300 ? `${error.slice(0, 300)}…` : error; checks.push(`\`${clean.replace(/`/g, "'")}\``); }
  }
  checks.push(''); checks.push('⚙️ *RUNTIME*');
  checks.push(`Node: ${process.version}`); checks.push(`Platform: ${process.platform}`); checks.push(`Architecture: ${process.arch}`); checks.push(`Uptime: ${formatUptime(process.uptime())}`);
  const activeProvider = getProviderInfo(chain.primary);
  const fallbackProvider = chain.chain.length > 1 ? getProviderInfo(chain.chain[1]) : null;
  let overall = '🟢 HEALTHY';
  if (!chain.valid || !activeProvider.keySet) overall = '🔴 CRITICAL';
  else if (fallbackProvider && !fallbackProvider.keySet) overall = '🟡 DEGRADED';
  else if (recentErrors.length) overall = '🟡 WARNING';
  return [`🩺 *CYBER-BOT HEALTH*`, `━━━━━━━━━━━━━━━━━━`, `Overall: ${overall}`, '', ...checks, '', '━━━━━━━━━━━━━━━━━━', `🕐 ${new Date().toISOString()}`].join('\n');
}

async function safeReply(ctx, text) {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[status] Markdown send failed, falling back to plain text:', err.message);
    try {
      await ctx.reply(text);
    } catch (err2) {
      console.error('[status] Plain text fallback also failed:', err2.message);
    }
  }
}

function registerStatus(bot) {
  const originalCommand = bot.command;
  bot.command = function(command, ...handlers) {
    return originalCommand.call(this, command, ...handlers.map(h => adminOnly(h)));
  };
  bot.command('status', async (ctx) => {
    await safeReply(ctx, buildStatus());
  });

  bot.command('health', async (ctx) => {
    await safeReply(ctx, buildHealth());
  });
}

module.exports = { registerStatus, buildStatus, buildHealth };

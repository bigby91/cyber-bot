#!/usr/bin/env bash
BOT_DIR="$HOME/cyber-bot"

echo "======================================"
echo "🤖 CYBER-BOT DIAGNOSTIC"
echo "======================================"
echo ""

echo "--- Process ---"
PROC=$(ps -eo pid,etime,rss,cmd 2>/dev/null | grep "node bot.js" | grep -v grep)
if [ -z "$PROC" ]; then
  echo "❌ NOT RUNNING"
else
  echo "✅ RUNNING"
  echo "$PROC"
fi
echo ""

echo "--- Telegram connectivity ---"
cd "$BOT_DIR" 2>/dev/null && node -e "
try { require('dotenv').config(); } catch {}
const https = require('https');
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.log('❌ TELEGRAM_BOT_TOKEN not set'); process.exit(0); }
try {
  https.get(\`https://api.telegram.org/bot\${token}/getWebhookInfo\`, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('pending_update_count:', parsed.result.pending_update_count);
        console.log('webhook url:', parsed.result.url || '(none - polling mode, expected)');
      } catch (e) {
        console.log('Could not parse Telegram response:', data.slice(0, 200));
      }
    });
  }).on('error', (e) => console.log('❌ Could not reach Telegram:', e.message));
} catch (e) {
  console.log('❌ Telegram check failed:', e.message);
}
"
echo ""

echo "--- AI provider config ---"
cd "$BOT_DIR" 2>/dev/null && node -e "
try { require('dotenv').config(); } catch {}
try {
  const { AI_PROVIDER } = require('./crons/config/providers');
  const KEY_ENV_MAP = { groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY', claude: 'CLAUDE_API_KEY' };
  console.log('Active provider:', AI_PROVIDER);
  Object.entries(KEY_ENV_MAP).forEach(([id, envVar]) => {
    console.log((process.env[envVar] ? '✅' : '❌') + ' ' + id + ' (' + envVar + ')');
  });
} catch (e) {
  console.log('❌ Could not load provider config:', e.message);
}
"
echo ""

echo "--- Storage & battery ---"
df -h "$BOT_DIR" 2>/dev/null | tail -1
BATTERY=$(termux-battery-status 2>/dev/null)
if [ -n "$BATTERY" ]; then
  echo "$BATTERY" | node -e "
let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  try {
    const b = JSON.parse(d);
    console.log('Battery: ' + b.percentage + '% (' + b.status + ')');
  } catch {
    console.log('Battery: unavailable');
  }
});
"
else
  echo "Battery: unavailable (termux-api not installed?)"
fi
echo ""

echo "--- Data counts ---"
for f in conversations.log data/reminders.json data/notes.json data/todos.json; do
  if [ -f "$BOT_DIR/$f" ]; then
    COUNT=$(wc -l < "$BOT_DIR/$f" 2>/dev/null | tr -d ' ')
    echo "✅ $f ($COUNT lines)"
  else
    echo "⚠️  $f (not found)"
  fi
done
echo ""

echo "--- Recent errors in bot.log (last 5) ---"
if [ -f "$BOT_DIR/bot.log" ]; then
  grep -iE "error|fatal|exception|failed" "$BOT_DIR/bot.log" | tail -5
else
  echo "bot.log not found"
fi
echo ""

echo "--- Last startup line ---"
if [ -f "$BOT_DIR/bot.log" ]; then
  grep -i "listener started\|launch() failed" "$BOT_DIR/bot.log" | tail -3
fi
echo ""
echo "======================================"
echo "Done: $(date)"
echo "======================================"

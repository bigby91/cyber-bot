#!/usr/bin/env bash
BOT_DIR="$HOME/cyber-bot"
cd "$BOT_DIR" 2>/dev/null

echo "🤖 CYBERBOT — WHAT THIS BOT IS"
echo "======================================"
echo ""
echo "A personal AI assistant bot running on Telegram, hosted entirely"
echo "on a phone via Termux — no server, no cloud hosting."
echo ""
echo "--- AI Engine ---"
node -e "
try { require('dotenv').config(); } catch {}
try {
  const { AI_PROVIDER } = require('./crons/config/providers');
  console.log('Primary provider: ' + AI_PROVIDER + ' (auto-fallback to a backup provider on rate limit)');
} catch (e) {
  console.log('Could not read provider config: ' + e.message);
}
"
echo ""
echo "--- Commands available ---"
grep -ohE "bot\.command\('[a-zA-Z_]+'" commands/*.js 2>/dev/null | sed -E "s/bot\.command\('([a-zA-Z_]+)'.*/\/\1/" | sort -u
echo ""
echo "--- Project stats ---"
echo "Command files: $(ls commands/*.js 2>/dev/null | wc -l | tr -d ' ')"
echo "Total lines of command code: $(cat commands/*.js 2>/dev/null | wc -l | tr -d ' ')"
echo "Conversations logged so far: $(wc -l < conversations.log 2>/dev/null | tr -d ' ')"
echo ""
echo "General-purpose chat: ask it anything directly (coding, security,"
echo "backend/frontend, deployment, testing) — no command needed. It"
echo "answers using the AI engine above, with live web search when relevant."

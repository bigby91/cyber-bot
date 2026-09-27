require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const logger = require('./config/logger');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const remindersPath = path.join(__dirname, '..', 'reminders.json');

if (!BOT_TOKEN) {
  logger.error('checkReminders: TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function checkReminders() {
  let reminders;
  try {
    reminders = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
  } catch (e) {
    logger.error(`checkReminders: failed to read reminders.json — ${e.message}`);
    return;
  }

  const now = new Date();
  let changed = false;

  for (const r of reminders) {
    if (r.sent) continue;

    // Naive due check: if "when" mentions a specific time we can't fully parse
    // without an NLP date parser, so for now we rely on triggerAt (ISO) if present.
    if (r.triggerAt && new Date(r.triggerAt) <= now) {
      try {
        await bot.telegram.sendMessage(r.chatId, `⏰ Reminder: ${r.text}`);
        r.sent = true;
        changed = true;
        logger.info(`checkReminders: sent reminder "${r.text}" to chat ${r.chatId}`);
      } catch (e) {
        logger.error(`checkReminders: failed to send reminder — ${e.message}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(remindersPath, JSON.stringify(reminders, null, 2));
  }
}

checkReminders().then(() => process.exit(0));

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generate } = require('./utils/generate');
const logger = require('./config/logger');

const conversationsPath = path.join(__dirname, '..', 'conversations.log');
const notesPath = path.join(__dirname, '..', 'learned_notes.txt');

const run = async () => {
  if (!fs.existsSync(conversationsPath)) {
    logger.info('learn.js: no conversations.log yet, skipping');
    return;
  }

  const lines = fs.readFileSync(conversationsPath, 'utf8').trim().split('\n').slice(-100);
  const conversations = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (conversations.length === 0) {
    logger.info('learn.js: no valid conversations to learn from');
    return;
  }

  const transcript = conversations
    .map((c) => `User: ${c.user}\nBot: ${c.bot}`)
    .join('\n---\n');

  const prompt = `You are reviewing recent chat logs from a Telegram bot to extract lasting improvements.
Look at these conversations and produce a SHORT bullet list (max 8 bullets) of things the bot should remember or do differently going forward - recurring topics, user corrections, preferences, mistakes to avoid.
Only include genuinely useful, general patterns - not one-off details.

Conversations:
${transcript}

Respond with ONLY the bullet list, nothing else.`;

  const notes = await generate(prompt, { skipValidation: true });

  if (notes) {
    fs.writeFileSync(notesPath, notes.trim());
    logger.info('learn.js: updated learned_notes.txt');
  } else {
    logger.warn('learn.js: generate() returned nothing');
  }
};

module.exports = { run };

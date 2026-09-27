const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '..', '..', 'conversation_memory.json');
const MAX_MESSAGES_PER_CHAT = 4;

const loadAll = () => {
  if (!fs.existsSync(MEMORY_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  } catch {
    return {};
  }
};

const saveAll = (data) => {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2));
};

const getHistory = (chatId) => {
  const all = loadAll();
  return all[chatId] || [];
};

const addExchange = (chatId, userText, botText) => {
  const all = loadAll();
  const history = all[chatId] || [];
  history.push({ role: 'user', text: userText });
  history.push({ role: 'assistant', text: botText });
  all[chatId] = history.slice(-MAX_MESSAGES_PER_CHAT * 2);
  saveAll(all);
};

module.exports = { getHistory, addExchange };

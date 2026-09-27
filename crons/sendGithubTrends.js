const logger = require('./config/logger');
const { sendMessage, sanitizeTelegramHtml } = require('./utils/sendMessage');
const { createObjectStore } = require('./utils/processedItems');

const STATE_PATH = 'assets/githubTrends.json';
const store = createObjectStore(STATE_PATH, { seenRepos: [] });

const TOPICS = ['cybersecurity', 'pentesting', 'ctf', 'vibe-coding', 'webdev', 'web-development', 'ai-coding'];

const fetchTrendingForTopic = async (topic) => {
  const url = `https://api.github.com/search/repositories?q=topic:${topic}&sort=updated&order=desc&per_page=5`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'cyber-bot', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    logger.warn(`GitHub API error for topic ${topic}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return (data.items || []).map((r) => ({
    id: r.full_name,
    name: r.full_name,
    description: r.description || '',
    url: r.html_url,
    stars: r.stargazers_count,
  }));
};

const run = async () => {
  const { seenRepos } = await store.load();
  const seenSet = new Set(seenRepos);

  let allRepos = [];
  for (const topic of TOPICS) {
    const repos = await fetchTrendingForTopic(topic);
    allRepos = allRepos.concat(repos);
  }

  const newRepos = allRepos.filter((r) => !seenSet.has(r.id));

  if (newRepos.length === 0) {
    logger.info('sendGithubTrends: no new repos found');
    return;
  }

  const lines = newRepos
    .slice(0, 8)
    .map((r) => `• <b>${sanitizeTelegramHtml(r.name)}</b> (★${r.stars})\n${sanitizeTelegramHtml(r.description)}\n${r.url}`);

  const message = `<b>New trending on GitHub:</b>\n\n${lines.join('\n\n')}`;

  await sendMessage(message, process.env.TELEGRAM_TOPIC_CTF, ['github'], { parse_mode: 'HTML' });

  const updatedSeen = Array.from(new Set([...seenRepos, ...newRepos.map((r) => r.id)])).slice(-200);
  await store.save({ seenRepos: updatedSeen });
};

module.exports = { run };

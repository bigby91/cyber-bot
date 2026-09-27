const cheerio = require('cheerio');
const logger = require('../config/logger');

const webSearch = async (query, maxResults = 3) => {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];
    $('.result__body').each((i, el) => {
      if (i >= maxResults) return;
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (title) results.push(`${title}: ${snippet}`);
    });

    return results;
  } catch (err) {
    logger.error(`webSearch error: ${err.message}`);
    return [];
  }
};

module.exports = { webSearch };

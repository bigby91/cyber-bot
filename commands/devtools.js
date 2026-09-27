const { adminOnly } = require('./admin');
const crypto = require('crypto');

function getArgs(ctx) {
  const text = ctx.message.text || '';
  const spaceIdx = text.indexOf(' ');
  return spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();
}

function registerDevTools(bot) {
  const originalCommand = bot.command;
  bot.command = function(command, ...handlers) {
    return originalCommand.call(this, command, ...handlers.map(h => adminOnly(h)));
  };
  bot.command('json', (ctx) => {
    const input = getArgs(ctx);
    if (!input) return ctx.reply('Usage: /json {"key":"value"}');
    try {
      const pretty = JSON.stringify(JSON.parse(input), null, 2);
      ctx.reply(pretty);
    } catch (e) {
      ctx.reply(`Invalid JSON — ${e.message}`);
    }
  });

  bot.command('base64e', (ctx) => {
    const input = getArgs(ctx);
    if (!input) return ctx.reply('Usage: /base64e some text');
    ctx.reply(Buffer.from(input, 'utf8').toString('base64'));
  });

  bot.command('base64d', (ctx) => {
    const input = getArgs(ctx);
    if (!input) return ctx.reply('Usage: /base64d base64string');
    try {
      ctx.reply(Buffer.from(input, 'base64').toString('utf8'));
    } catch (e) {
      ctx.reply(`Couldn't decode — ${e.message}`);
    }
  });

  bot.command('uuid', (ctx) => {
    ctx.reply(crypto.randomUUID());
  });

  bot.command('hash', (ctx) => {
    const input = getArgs(ctx);
    if (!input) return ctx.reply('Usage: /hash some text');
    ctx.reply(crypto.createHash('sha256').update(input, 'utf8').digest('hex'));
  });

  bot.command('regex', (ctx) => {
    const input = getArgs(ctx);
    const delim = input.indexOf('::');
    if (delim === -1) {
      return ctx.reply('Usage: /regex pattern::text  (add flags after a trailing /, e.g. foo/i::Foobar)');
    }
    let pattern = input.slice(0, delim).trim();
    const text = input.slice(delim + 2).trim();
    let flags = '';
    const flagMatch = pattern.match(/\/([a-z]*)$/i);
    if (flagMatch) {
      flags = flagMatch[1];
      pattern = pattern.slice(0, pattern.length - flagMatch[0].length);
    }
    try {
      const re = new RegExp(pattern, flags);
      const match = text.match(re);
      ctx.reply(match ? `Match: ${JSON.stringify(match)}` : 'No match.');
    } catch (e) {
      ctx.reply(`Bad pattern — ${e.message}`);
    }
  });

  bot.command('timestamp', (ctx) => {
    const input = getArgs(ctx);
    if (!input) {
      return ctx.reply('Usage: /timestamp 1735689600  or  /timestamp 2025-01-01T00:00:00Z');
    }
    if (/^\d+$/.test(input)) {
      const ms = input.length <= 10 ? Number(input) * 1000 : Number(input);
      const d = new Date(ms);
      if (isNaN(d.getTime())) return ctx.reply('Out of range.');
      return ctx.reply(d.toISOString());
    }
    const d = new Date(input);
    if (isNaN(d.getTime())) return ctx.reply("Couldn't parse that as a date or timestamp.");
    ctx.reply(`${d.getTime()} (ms) / ${Math.floor(d.getTime() / 1000)} (s)`);
  });
}

module.exports = { registerDevTools };

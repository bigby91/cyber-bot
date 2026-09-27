function registerHelp(bot) {
  bot.command('help', async (ctx) => {
    const lines = [
      '🤖 *Cyberbot — Commands*',
      '',
      '*🛠 Dev Tools*',
      '/json <json> — pretty-print & validate',
      '/base64e <text> — encode to base64',
      '/base64d <text> — decode from base64',
      '/uuid — generate a random UUID',
      '/hash <text> — SHA-256 hash',
      '/regex <pattern>::<text> — test a regex',
      '/timestamp <value> — convert timestamp ⇄ date',
      '',
      '*📊 Status*',
      '/status — quick snapshot (uptime, memory, storage, AI provider)',
      '/health — deep health check (keys, files, logs)',
      '',
      '*📝 Personal*',
      '/remind 30m|tomorrow 09:00|18:30 <text> — set a reminder',
      '/reminders — list your active reminders',
      '/unremind <n> — cancel a reminder',
      '/note <text> — save a note',
      '/notes — list your notes',
      '/forget <n> — delete a note',
      '/todo add <task> | list | done <n> | remove <n>',
      '',
      '*⚙️ Owner-only*',
      '/users — user activity stats',
      '/events — recent system events/crashes',
      '/selftest — core file & config self-test',
      '',
      '_Anything else — just ask me directly, no command needed._',
    ];
    const text = lines.join('\n');
    try {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[help] Markdown send failed, falling back to plain text:', err.message);
      await ctx.reply(text.replace(/[*_]/g, ''));
    }
  });
}

module.exports = { registerHelp };

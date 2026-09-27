const ADMIN_IDS = new Set(
  String(process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
);

function isAdmin(ctx) {
  return ADMIN_IDS.has(String(ctx.from?.id));
}

function adminOnly(handler) {
  return async (ctx, next) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ This command is restricted to the bot owner.');
    }

    return handler(ctx, next);
  };
}

module.exports = {
  isAdmin,
  adminOnly,
};

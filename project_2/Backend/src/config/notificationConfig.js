module.exports = {
  telegram: {
    enabled: true,
    token: process.env.TELEGRAM_TOKEN || "",
  },

  // ← FIXED: was SUBSCRIBE_PASSWORD, now SUBSCRIBE_PASS
  subscribePassword: process.env.SUBSCRIBE_PASS,

  cooldownSeconds: 60,

  triggers: {
    flame: true,
    mq2: true,
    mq4: true,
    temp: true,
    offline: true,
    allClear: true,
  },
};

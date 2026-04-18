// ─── Notification Configuration ──────────────────────────────
// STEP 1: Replace the values below with your Telegram details
// STEP 2: Change subscribePassword to something only you know
//
// HOW TO GET TOKEN + CHAT_ID:
//   1. Open Telegram → search @BotFather → send /newbot
//   2. Follow steps → copy the TOKEN it gives
//   3. Search your new bot → click Start → send any message
//   4. Open in browser: https://api.telegram.org/bot<TOKEN>/getUpdates
//   5. Find "chat" → "id" in the response → that is your CHAT_ID

module.exports = {
  telegram: {
    enabled: true,
    token: process.env.TELEGRAM_TOKEN || "", // e.g. '7123456789:AAF...'
  },

  // Judges type this in Telegram to subscribe:  /subscribe hackathon2024
  subscribePassword: process.env.SUBSCRIBE_PASSWORD,

  // Seconds before the same alert fires again (stops spamming)
  cooldownSeconds: 60,

  // Toggle each notification type on/off
  triggers: {
    flame: true,
    mq2: true,
    mq4: true,
    temp: true,
    offline: true,
    allClear: true,
  },
};

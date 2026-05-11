require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const notificationService = require("./notificationService");

const helperBot = new TelegramBot(process.env.HELPER_BOT_TOKEN, {
  polling: true,
});

console.log("✅ Helper bot started");

// ─────────────────────────────────────────────
// MESSAGE HANDLER
// ─────────────────────────────────────────────

helperBot.on("message", async (msg) => {
  console.log("\n📩 MESSAGE RECEIVED");

  console.log("CHAT ID:", msg.chat.id);

  console.log("TEXT:", msg.text);

  // SHOW CHAT ID
  if (msg.text === "/start") {
    await helperBot.sendMessage(
      msg.chat.id,

      `✅ Your Chat ID is:\n${msg.chat.id}\n\nCopy this into .env as HELPER_CHAT_ID`,
    );

    return;
  }

  // HELPER ACCEPTED
  if (msg.text === "YES") {
    console.log("✅ Helper accepted emergency");

    await helperBot.sendMessage(
      msg.chat.id,

      "✅ Emergency accepted",
    );

     await notificationService.sendTelegramMessage(
       `✅ Helper accepted emergency request.

👤 Helper: ${msg.from.first_name}

🚨 Emergency response is now active.`,
     );

     return;
  }
});

// ─────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────

helperBot.on("polling_error", console.log);

module.exports = helperBot;

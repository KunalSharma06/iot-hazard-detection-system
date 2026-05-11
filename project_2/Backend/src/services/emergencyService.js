const helperBot = require("./helperBot");

async function startEmergency(room) {
  const helperChatId = process.env.HELPER_CHAT_ID;

  if (!helperChatId) {
    console.log("❌ No helper chat ID");

    return;
  }

  try {
    await helperBot.sendMessage(
      helperChatId,

      `🚨 Emergency Alert

Danger detected in Room ${room}.

Reply YES if you can help.`,
    );

    console.log("✅ Emergency message sent");
  } catch (err) {
    console.log(err);
  }
}

module.exports = {
  startEmergency,
};

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const notificationService = require("./notificationService");

const helperBot = new TelegramBot(process.env.HELPER_BOT_TOKEN, {
  polling: true,
});

console.log("✅ Helper bot started");

// Emergency tracking
const emergencyTracker = new Map();

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
});

// ─────────────────────────────────────────────
// CALLBACK QUERY HANDLER (Button Responses)
// ─────────────────────────────────────────────

helperBot.on("callback_query", async (query) => {
  const { id, from, data, message } = query;
  const helperName = from.first_name || "Helper";

  console.log("\n🔘 CALLBACK RECEIVED");
  console.log("ACTION:", data);
  console.log("HELPER:", helperName);

  try {
    // HELPER ACCEPTED
    if (data.startsWith("accept_")) {
      const emergencyId = data.replace("accept_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency expired",
          show_alert: true,
        });
        return;
      }

      // Update status
      emergency.status = "accepted";
      emergency.helperName = helperName;
      emergency.acceptedAt = new Date();

      // Edit the original message
      await helperBot.editMessageText(
        `🚨 EMERGENCY ALERT - ROOM ${emergency.room}\n\n` +
          `Temperature: ${emergency.temp}°C\n` +
          `Humidity: ${emergency.humidity}%\n\n` +
          `✅ ACCEPTED by ${helperName}\n` +
          `⏰ Accepted at: ${emergency.acceptedAt.toLocaleTimeString()}`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "👀 View Details",
                  callback_data: `details_${emergencyId}`,
                },
              ],
            ],
          },
        },
      );

      // Notify all users
      await notificationService.sendTelegramMessage(
        `✅ EMERGENCY ACCEPTED\n\n` +
          `👤 Helper: ${helperName}\n` +
          `🏠 Room: ${emergency.room}\n` +
          `🌡️ Condition: ${emergency.message}\n` +
          `⏰ Response Time: ${emergency.responseTime}s`,
      );

      await helperBot.answerCallbackQuery(id, {
        text: "✅ Emergency accepted!",
        show_alert: false,
      });
    }

    // HELPER REJECTED
    else if (data.startsWith("reject_")) {
      const emergencyId = data.replace("reject_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency expired",
          show_alert: true,
        });
        return;
      }

      emergency.status = "rejected";
      emergency.rejectedBy = helperName;

      await helperBot.editMessageText(
        `🚨 EMERGENCY ALERT - ROOM ${emergency.room}\n\n` +
          `Temperature: ${emergency.temp}°C\n` +
          `Humidity: ${emergency.humidity}%\n\n` +
          `❌ REJECTED by ${helperName}`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
        },
      );

      await notificationService.sendTelegramMessage(
        `❌ EMERGENCY REJECTED\n\n` +
          `👤 Helper: ${helperName}\n` +
          `🏠 Room: ${emergency.room}\n` +
          `📝 Reason: Unable to assist\n` +
          `⏰ Time: ${new Date().toLocaleTimeString()}`,
      );

      await helperBot.answerCallbackQuery(id, {
        text: "❌ Emergency rejected",
        show_alert: false,
      });
    }

    // VIEW DETAILS
    else if (data.startsWith("details_")) {
      const emergencyId = data.replace("details_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (emergency) {
        const details =
          `📋 EMERGENCY DETAILS\n\n` +
          `🆔 ID: ${emergencyId}\n` +
          `🏠 Room: ${emergency.room}\n` +
          `🌡️ Temperature: ${emergency.temp}°C\n` +
          `💧 Humidity: ${emergency.humidity}%\n` +
          `📝 Alert: ${emergency.message}\n` +
          `⏰ Detected: ${emergency.detectedAt.toLocaleTimeString()}\n` +
          `👤 Status: ${emergency.status}\n` +
          (emergency.helperName ? `👨‍🚒 Helper: ${emergency.helperName}\n` : "");

        await helperBot.sendMessage(msg.chat.id, details);
      }
    }

    // SEND HELP ARRIVING
    else if (data.startsWith("help_arriving_")) {
      const emergencyId = data.replace("help_arriving_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (emergency) {
        emergency.status = "help_arriving";
        emergency.eta = "5-10 minutes";

        await notificationService.sendTelegramMessage(
          `🚗 HELP ON THE WAY\n\n` +
            `👤 Helper: ${helperName}\n` +
            `🏠 Room: ${emergency.room}\n` +
            `⏱️ ETA: ${emergency.eta}`,
        );

        await helperBot.answerCallbackQuery(id, {
          text: "✅ Notification sent!",
          show_alert: false,
        });
      }
    }

    // EMERGENCY RESOLVED
    else if (data.startsWith("resolved_")) {
      const emergencyId = data.replace("resolved_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (emergency) {
        emergency.status = "resolved";
        emergency.resolvedAt = new Date();
        const responseTime = Math.floor(
          (emergency.resolvedAt - emergency.detectedAt) / 1000,
        );

        await helperBot.editMessageText(
          `✅ EMERGENCY RESOLVED\n\n` +
            `🏠 Room: ${emergency.room}\n` +
            `👤 Helper: ${helperName}\n` +
            `⏱️ Total Response Time: ${responseTime}s\n` +
            `⏰ Resolved at: ${emergency.resolvedAt.toLocaleTimeString()}`,
          {
            chat_id: message.chat.id,
            message_id: message.message_id,
          },
        );

        await notificationService.sendTelegramMessage(
          `✅ EMERGENCY RESOLVED\n\n` +
            `👤 Helper: ${helperName}\n` +
            `🏠 Room: ${emergency.room}\n` +
            `⏱️ Response Time: ${responseTime}s\n` +
            `🎯 Status: All Clear`,
        );
      }
    }
  } catch (err) {
    console.error("❌ Error handling callback:", err);
    await helperBot.answerCallbackQuery(id, {
      text: "❌ Error processing request",
      show_alert: true,
    });
  }
});

// ─────────────────────────────────────────────
// SEND EMERGENCY WITH INTERACTIVE BUTTONS
// ─────────────────────────────────────────────

async function sendEmergencyAlert(room, sensorData) {
  const helperChatId = process.env.HELPER_CHAT_ID;

  if (!helperChatId) {
    console.log("❌ No helper chat ID");
    return;
  }

  const emergencyId = `EMG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const emergency = {
    id: emergencyId,
    room,
    temp: sensorData.temperature,
    humidity: sensorData.humidity,
    message: sensorData.message,
    status: "pending",
    detectedAt: new Date(),
  };

  emergencyTracker.set(emergencyId, emergency);

  try {
    await helperBot.sendMessage(
      helperChatId,
      `🚨 EMERGENCY ALERT\n\n` +
        `🏠 Room: ${room}\n` +
        `🌡️ Temperature: ${sensorData.temperature}°C\n` +
        `💧 Humidity: ${sensorData.humidity}%\n` +
        `⚠️ Alert: ${sensorData.message}\n\n` +
        `📍 Action Required!`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Accept",
                callback_data: `accept_${emergencyId}`,
              },
              {
                text: "❌ Reject",
                callback_data: `reject_${emergencyId}`,
              },
            ],
            [
              {
                text: "📋 Details",
                callback_data: `details_${emergencyId}`,
              },
            ],
          ],
        },
      },
    );

    console.log("✅ Interactive emergency alert sent");
    return emergencyId;
  } catch (err) {
    console.error("❌ Error sending alert:", err);
  }
}

// ─────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────

helperBot.on("polling_error", console.log);

module.exports = {
  helperBot,
  sendEmergencyAlert,
};

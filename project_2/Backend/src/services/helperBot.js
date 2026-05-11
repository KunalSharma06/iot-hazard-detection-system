require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const notificationService = require("./notificationService");

// HELPER BOT
const helperBot = new TelegramBot(process.env.HELPER_BOT_TOKEN, {
  polling: true,
});

// MAIN BOT (NO POLLING)
const mainBot = new TelegramBot(process.env.TELEGRAM_TOKEN);

console.log("✅ Helper Bot Started - INTERACTIVE BUTTONS");

// ════════════════════════════════════════════════════════════
// EMERGENCY TRACKER
// ════════════════════════════════════════════════════════════

const emergencyTracker = new Map();

function storeEmergency(id, data) {
  emergencyTracker.set(id, data);
  console.log(`✅ Emergency ${id} stored`);
}

function getEmergency(id) {
  return emergencyTracker.get(id);
}

// ════════════════════════════════════════════════════════════
// LOCATION DATABASE
// ════════════════════════════════════════════════════════════

const locationDatabase = {
  1: {
    name: "Room 1",
    building: "Main Building",
    floor: "Ground Floor",
    address: "Factory Address",
    coordinates: { lat: 19.0176, lng: 72.8479 },
  },

  2: {
    name: "Room 2",
    building: "Warehouse",
    floor: "First Floor",
    address: "Factory Address",
    coordinates: { lat: 19.0176, lng: 72.8479 },
  },
};

// ════════════════════════════════════════════════════════════
// SEND EMERGENCY ALERT
// ════════════════════════════════════════════════════════════

async function sendEmergencyAlert(roomId, sensorData) {
  try {
    const helperChatId = process.env.HELPER_CHAT_ID;

    if (!helperChatId) {
      console.log("❌ HELPER_CHAT_ID missing");
      return;
    }

    const location = locationDatabase[roomId] || {
      name: `Room ${roomId}`,
      building: "Unknown",
      floor: "Unknown",
      address: "Unknown",
      coordinates: { lat: 0, lng: 0 },
    };

    const emergencyId = `EMG_${Date.now()}`;

    const emergency = {
      id: emergencyId,
      roomId,
      location,
      sensorData,
      detectedAt: new Date(),
      status: "pending",
      helperName: null,
    };

    storeEmergency(emergencyId, emergency);

    const alertMessage = `
🚨 *EMERGENCY ALERT*

📍 *Location:* ${location.name}

⚠️ *Alert:* ${sensorData.message}

🌡️ Temp: ${sensorData.temperature}°C
💧 Humidity: ${sensorData.humidity}%
💨 MQ2: ${sensorData.mq2}
🔥 MQ4: ${sensorData.mq4}

⏰ ${new Date().toLocaleTimeString()}
`;

    await helperBot.sendMessage(helperChatId, alertMessage, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Accept & Going",
              callback_data: `accept_${emergencyId}`,
            },

            {
              text: "❌ Reject",
              callback_data: `reject_${emergencyId}`,
            },
          ],
        ],
      },
    });

    console.log("✅ Emergency alert sent");
  } catch (err) {
    console.log("❌ sendEmergencyAlert Error:", err.message);
  }
}

// ════════════════════════════════════════════════════════════
// CALLBACK HANDLER
// ════════════════════════════════════════════════════════════

helperBot.on("callback_query", async (query) => {
  const { id, from, data, message } = query;

  const helperName = from.first_name || "Helper";

  console.log("🔘 Button:", data);

  try {
    // ═══════════════════════════════════
    // ACCEPT
    // ═══════════════════════════════════

    if (data.startsWith("accept_")) {
      const emergencyId = data.replace("accept_", "").trim();

      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      // prevent duplicate accept
      if (emergency.status === "accepted") {
        await helperBot.answerCallbackQuery(id, {
          text: "⚠️ Emergency already accepted",
          show_alert: false,
        });
        return;
      }

      emergency.status = "accepted";
      emergency.helperName = helperName;
      emergency.acceptedAt = new Date();

      // update helper message
      await helperBot.editMessageText(
        `
✅ *Emergency Accepted*

👤 Helper: ${helperName}
📍 Location: ${emergency.location.name}

🚗 OK, please come quickly.

Have you arrived?
`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: "Markdown",

          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Yes, Arrived",
                  callback_data: `arrived_${emergency.id}`,
                },
              ],
            ],
          },
        },
      );

      // notify main bot
      await mainBot.sendMessage(
        process.env.MAIN_CHAT_ID,
        `
✅ *Emergency Accepted*

👤 Helper: ${helperName}
📍 ${emergency.location.name}

🚗 Helper is coming quickly.
`,
        {
          parse_mode: "Markdown",
        },
      );

      await helperBot.answerCallbackQuery(id, {
        text: "Accepted successfully",
        show_alert: false,
      });
    }

    // ═══════════════════════════════════
    // ARRIVED
    // ═══════════════════════════════════
    else if (data.startsWith("arrived_")) {
      const emergencyId = data.replace("arrived_", "").trim();

      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      emergency.status = "arrived";
      emergency.arrivedAt = new Date();

      await helperBot.editMessageText(
        `
🚗 *Helper Arrived Successfully*

👤 ${helperName}
📍 ${emergency.location.name}

✅ Waiting for further action.
`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: "Markdown",
        },
      );

      // notify main bot
      await mainBot.sendMessage(
        process.env.MAIN_CHAT_ID,
        `
🚗 *Helper has arrived at the location.*

👤 ${helperName}
📍 ${emergency.location.name}
`,
        {
          parse_mode: "Markdown",
        },
      );

      await helperBot.answerCallbackQuery(id, {
        text: "Arrival recorded",
        show_alert: false,
      });
    }

    // ═══════════════════════════════════
    // REJECT
    // ═══════════════════════════════════
    else if (data.startsWith("reject_")) {
      const emergencyId = data.replace("reject_", "").trim();

      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      emergency.status = "rejected";

      await helperBot.editMessageText(
        `
❌ *Emergency Rejected*

👤 ${helperName}
📍 ${emergency.location.name}

⚠️ Waiting for another helper.
`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: "Markdown",
        },
      );

      await mainBot.sendMessage(
        process.env.MAIN_CHAT_ID,
        `
❌ *Emergency Rejected*

👤 ${helperName}
📍 ${emergency.location.name}
`,
        {
          parse_mode: "Markdown",
        },
      );

      await helperBot.answerCallbackQuery(id, {
        text: "Rejected",
        show_alert: false,
      });
    }
  } catch (err) {
    console.log("❌ CALLBACK ERROR:", err.message);

    try {
      await helperBot.answerCallbackQuery(id, {
        text: "❌ Error occurred",
        show_alert: false,
      });
    } catch (e) {}
  }
});

// ════════════════════════════════════════════════════════════
// START MESSAGE
// ════════════════════════════════════════════════════════════

helperBot.on("message", async (msg) => {
  if (msg.text === "/start") {
    await helperBot.sendMessage(
      msg.chat.id,
      `
✅ *Helper Bot Ready*

Your Chat ID:
\`${msg.chat.id}\`

Add in .env:

\`HELPER_CHAT_ID=${msg.chat.id}\`
\`MAIN_CHAT_ID=${msg.chat.id}\`

Waiting for emergency alerts...
`,
      {
        parse_mode: "Markdown",
      },
    );
  }
});

// polling error
helperBot.on("polling_error", (err) => {
  console.log("Polling error:", err.message);
});

// EXPORT
module.exports = {
  sendEmergencyAlert,
  emergencyTracker,
};

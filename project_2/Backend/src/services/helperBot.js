require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const notificationService = require("./notificationService");

// ════════════════════════════════════════════════════════════
// BOTS
// ════════════════════════════════════════════════════════════

// HELPER BOT
const helperBot = new TelegramBot(process.env.HELPER_BOT_TOKEN, {
  polling: true,
});

// MAIN BOT
const mainBot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

console.log("✅ Factory Emergency System Started");

// ════════════════════════════════════════════════════════════
// AUTO REGISTER USERS
// ════════════════════════════════════════════════════════════

const helperUsers = new Set();
const mainUsers = new Set();

// ════════════════════════════════════════════════════════════
// EMERGENCY STORAGE
// ════════════════════════════════════════════════════════════

const emergencyTracker = new Map();

function storeEmergency(id, data) {
  emergencyTracker.set(id, data);
  console.log(`✅ Emergency Stored: ${id}`);
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
    coordinates: {
      lat: 19.0176,
      lng: 72.8479,
    },
  },

  2: {
    name: "Room 2",
    building: "Warehouse",
    floor: "First Floor",
    address: "Factory Address",
    coordinates: {
      lat: 19.0176,
      lng: 72.8479,
    },
  },
};

// ════════════════════════════════════════════════════════════
// SEND EMERGENCY ALERT
// ════════════════════════════════════════════════════════════

async function sendEmergencyAlert(roomId, sensorData) {
  try {
    if (helperUsers.size === 0) {
      console.log("❌ No helpers registered");
      return;
    }

    const location = locationDatabase[roomId] || {
      name: `Room ${roomId}`,
      building: "Unknown",
      floor: "Unknown",
      address: "Unknown",
      coordinates: {
        lat: 0,
        lng: 0,
      },
    };

    // UNIQUE EMERGENCY ID
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

    // ═══════════════════════════════
    // HAZARD ANALYSIS
    // ═══════════════════════════════

    let dangerReason = "";
    let severity = "⚠️ MEDIUM";

    if (sensorData.temperature >= 70) {
      dangerReason += `🔥 High Temperature Detected (${sensorData.temperature}°C)\n`;
    }

    if (sensorData.mq2 >= 300) {
      dangerReason += `💨 MQ2 Gas Leak Detected\n`;
      dangerReason += `Possible: LPG / CNG / Butane / Smoke\n`;
    }

    if (sensorData.mq4 >= 300) {
      dangerReason += `🔥 MQ4 Methane Gas Detected\n`;
    }

    if (sensorData.flame) {
      dangerReason += `🚨 Flame Detected\n`;
      severity = "🚨 CRITICAL";
    }

    if (
      sensorData.temperature >= 90 ||
      sensorData.mq2 >= 500 ||
      sensorData.mq4 >= 500
    ) {
      severity = "🚨 CRITICAL";
    }

    // ═══════════════════════════════
    // ALERT MESSAGE
    // ═══════════════════════════════

    const alertMessage = `
🚨 *EMERGENCY ALERT*

${severity}

📍 *Location:* ${location.name}

🏢 Building: ${location.building}
🏠 Floor: ${location.floor}

━━━━━━━━━━━━━━━
⚠️ *Detected Hazard*
━━━━━━━━━━━━━━━

${dangerReason || "Unknown Hazard"}

━━━━━━━━━━━━━━━
📊 *Sensor Readings*
━━━━━━━━━━━━━━━

🌡️ Temperature: ${sensorData.temperature}°C
💧 Humidity: ${sensorData.humidity}%

💨 MQ2 Sensor: ${sensorData.mq2}
Possible: LPG / CNG / Butane / Smoke

🔥 MQ4 Sensor: ${sensorData.mq4}
Possible: Methane Gas

🔴 Flame Sensor:
${sensorData.flame ? "YES - FIRE DETECTED" : "NO"}

⏰ Time: ${new Date().toLocaleTimeString()}

⚡ Immediate action may be required.
`;

    // SEND TO ALL HELPERS
    for (const helperId of helperUsers) {
      await helperBot.sendMessage(helperId, alertMessage, {
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

            [
              {
                text: "📋 View Details",
                callback_data: `details_${emergencyId}`,
              },

              {
                text: "📍 View Location",
                callback_data: `location_${emergencyId}`,
              },
            ],
          ],
        },
      });
    }

    // SEND ALERT TO ALL MAIN USERS
    for (const userId of mainUsers) {
      await mainBot.sendMessage(
        userId,
        `
🚨 *Factory Emergency Detected*

📍 ${location.name}

⚠️ ${dangerReason || "Emergency detected"}

👷 Waiting for helper response...
`,
        {
          parse_mode: "Markdown",
        },
      );
    }

    console.log("✅ Emergency Alert Sent");
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

  console.log("🔘 Button Clicked:", data);

  try {
    // ═══════════════════════════════
    // ACCEPT
    // ═══════════════════════════════

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

      // ALREADY ACCEPTED
      if (emergency.status === "accepted") {
        await helperBot.answerCallbackQuery(id, {
          text: "⚠️ Already accepted by another helper",
          show_alert: true,
        });
        return;
      }

      emergency.status = "accepted";
      emergency.helperName = helperName;
      emergency.acceptedAt = new Date();

      // UPDATE HELPER MESSAGE
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

      // SEND TO ALL MAIN USERS
      for (const userId of mainUsers) {
        await mainBot.sendMessage(
          userId,
          `
✅ *Emergency Accepted*

👤 ${helperName}
📍 ${emergency.location.name}

🚗 Helper is coming quickly.
`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      await helperBot.answerCallbackQuery(id, {
        text: "Accepted Successfully",
        show_alert: false,
      });
    }

    // ═══════════════════════════════
    // REJECT
    // ═══════════════════════════════
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

      for (const userId of mainUsers) {
        await mainBot.sendMessage(
          userId,
          `
❌ *Emergency Rejected*

👤 ${helperName}
📍 ${emergency.location.name}
`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      await helperBot.answerCallbackQuery(id, {
        text: "Rejected",
        show_alert: false,
      });
    }

    // ═══════════════════════════════
    // DETAILS
    // ═══════════════════════════════
    else if (data.startsWith("details_")) {
      const emergencyId = data.replace("details_", "").trim();

      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      const detailsMessage = `
📋 *Emergency Details*

📍 ${emergency.location.name}

🏢 ${emergency.location.building}
🏠 ${emergency.location.floor}

⚠️ ${emergency.sensorData.message}

🌡️ Temperature: ${emergency.sensorData.temperature}°C
💧 Humidity: ${emergency.sensorData.humidity}%

💨 MQ2: ${emergency.sensorData.mq2}
🔥 MQ4: ${emergency.sensorData.mq4}

🔴 Flame:
${emergency.sensorData.flame ? "YES" : "NO"}

⏰ ${emergency.detectedAt.toLocaleTimeString()}
`;

      await helperBot.sendMessage(from.id, detailsMessage, {
        parse_mode: "Markdown",
      });

      await helperBot.answerCallbackQuery(id, {
        text: "📋 Details Sent",
        show_alert: false,
      });
    }

    // ═══════════════════════════════
    // LOCATION
    // ═══════════════════════════════
    else if (data.startsWith("location_")) {
      const emergencyId = data.replace("location_", "").trim();

      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      await helperBot.sendLocation(
        from.id,
        emergency.location.coordinates.lat,
        emergency.location.coordinates.lng,
      );

      await helperBot.sendMessage(
        from.id,
        `
📍 *Factory Location*

🏢 ${emergency.location.name}
📌 ${emergency.location.address}
`,
        {
          parse_mode: "Markdown",
        },
      );

      await helperBot.answerCallbackQuery(id, {
        text: "📍 Location Sent",
        show_alert: false,
      });
    }

    // ═══════════════════════════════
    // ARRIVED
    // ═══════════════════════════════
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

      // SEND TO MAIN USERS
      for (const userId of mainUsers) {
        await mainBot.sendMessage(
          userId,
          `
🚗 *Helper Arrived*

👤 ${helperName}
📍 ${emergency.location.name}
`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      await helperBot.answerCallbackQuery(id, {
        text: "Arrival Recorded",
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
// HELPER REGISTRATION
// ════════════════════════════════════════════════════════════

helperBot.on("message", async (msg) => {
  if (msg.text === "/start") {
    helperUsers.add(msg.chat.id);

    console.log("✅ Helper Registered:", msg.chat.id);

    await helperBot.sendMessage(
      msg.chat.id,
      `
👷 *Factory Helper Registered*

You will now receive emergency alerts.
`,
      {
        parse_mode: "Markdown",
      },
    );
  }
});

// ════════════════════════════════════════════════════════════
// MAIN USER REGISTRATION
// ════════════════════════════════════════════════════════════

mainBot.on("message", async (msg) => {
  if (msg.text === "/start") {
    mainUsers.add(msg.chat.id);

    console.log("✅ Main User Registered:", msg.chat.id);

    await mainBot.sendMessage(
      msg.chat.id,
      `
🏭 *Hazard Monitor System*

You will now receive:

🚨 Emergency alerts
👷 Helper updates
🚗 Arrival notifications
`,
      {
        parse_mode: "Markdown",
      },
    );
  }
});

// ════════════════════════════════════════════════════════════
// POLLING ERROR
// ════════════════════════════════════════════════════════════

helperBot.on("polling_error", (err) => {
  console.log("Helper Bot Error:", err.message);
});

mainBot.on("polling_error", (err) => {
  console.log("Main Bot Error:", err.message);
});

// ════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════

module.exports = {
  sendEmergencyAlert,
  emergencyTracker,
};

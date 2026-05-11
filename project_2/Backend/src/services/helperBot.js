require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const notificationService = require("./notificationService");

const helperBot = new TelegramBot(process.env.HELPER_BOT_TOKEN, {
  polling: true,
});

const mainBot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: false,
});

console.log("✅ Helper Bot Started - INTERACTIVE BUTTONS (FIXED VERSION)");

// ════════════════════════════════════════════════════════════
// EMERGENCY TRACKER - Store emergencies WITH LONG EXPIRY
// ════════════════════════════════════════════════════════════

const emergencyTracker = new Map();

// Keep emergencies in memory for 24 hours (no expiry)
function storeEmergency(id, data) {
  emergencyTracker.set(id, data);
  console.log(`✅ Emergency ${id} stored`);
}

function getEmergency(id) {
  const emergency = emergencyTracker.get(id);
  if (!emergency) {
    console.log(`❌ Emergency ${id} not found!`);
    console.log(`Available: ${Array.from(emergencyTracker.keys()).join(", ")}`);
  }
  return emergency;
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
  const helperChatId = process.env.HELPER_CHAT_ID;

  if (!helperChatId) {
    console.log("❌ No HELPER_CHAT_ID in .env");
    return;
  }

  const location = locationDatabase[roomId] || {
    name: `Room ${roomId}`,
    building: "Unknown",
    floor: "Unknown",
    address: "Unknown",
    coordinates: { lat: 0, lng: 0 },
  };

  // Create emergency ID - MUST be simple and unique
  const emergencyId = `EMG_${Date.now()}`;

  // Store emergency data
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

  console.log(`\n🚨 EMERGENCY ALERT CREATED`);
  console.log(`   ID: ${emergencyId}`);
  console.log(`   Room: ${location.name}`);
  console.log(`   Alert: ${sensorData.message}`);

  try {
    const message = `
🚨 *EMERGENCY ALERT - CRITICAL*

*📍 Location:*
${location.name}
Building: ${location.building}
Floor: ${location.floor}
Address: ${location.address}

*⚠️ Alert:* ${sensorData.message}

*📊 Readings:*
🌡️ Temp: ${sensorData.temperature}°C
💧 Humidity: ${sensorData.humidity}%
💨 MQ2: ${sensorData.mq2} ppm
🔥 MQ4: ${sensorData.mq4} ppm
🔴 Flame: ${sensorData.flame ? "YES ⚠️" : "NO"}

*🆔 ID:* \`${emergencyId}\`
*⏰ Time:* ${emergency.detectedAt.toLocaleTimeString()}

*📍 ACTION REQUIRED!*
    `;

    const result = await helperBot.sendMessage(helperChatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Accept & Going",
              callback_data: `accept_${emergencyId}`,
            },
            {
              text: "❌ Cannot Help",
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

    console.log(
      `✅ Alert sent to helper bot, message ID: ${result.message_id}`,
    );
    return emergencyId;
  } catch (err) {
    console.error("❌ Error sending alert:", err.message);
  }
}

// ════════════════════════════════════════════════════════════
// CALLBACK HANDLER
// ════════════════════════════════════════════════════════════

helperBot.on("callback_query", async (query) => {
  const { id, from, data, message } = query;
  const helperName = from.first_name || "Helper";

  console.log(`\n🔘 BUTTON CLICKED: ${data}`);
  console.log(`   Helper: ${helperName}`);

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACCEPT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (data.startsWith("accept_")) {
      const emergencyId = data.replace("accept_", "").trim();

      console.log("Accept clicked for:", emergencyId);
      console.log("Available IDs:", [...emergencyTracker.keys()]);

      let emergency = getEmergency(emergencyId);

      // fallback check
      if (!emergency && emergencyTracker.size > 0) {
        emergency = [...emergencyTracker.values()].find(
          (e) => e.status === "pending",
        );
      }

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      emergency.status = "accepted";
      emergency.helperName = helperName;
      emergency.acceptedAt = new Date();

      // Update helper message
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

      // Send notification to MAIN BOT
      await mainBot.sendMessage(
        process.env.MAIN_CHAT_ID,
        `
✅ *Emergency Accepted*

👤 Helper: ${helperName}
📍 Location: ${emergency.location.name}

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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // REJECT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("reject_")) {
      const emergencyId = data.replace("reject_", "");
      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      emergency.status = "rejected";
      emergency.rejectedBy = helperName;

      const editMessage = `
❌ *EMERGENCY REJECTED*

📍 ${emergency.location.name}
👤 Helper: ${helperName}

⚠️ *Looking for another helper...*
      `;

      await helperBot.editMessageText(editMessage, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
      });

      await sendToMainBot(emergency, "REJECTED");

      await helperBot.answerCallbackQuery(id, {
        text: "❌ Rejection recorded",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // VIEW DETAILS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("details_")) {
      const emergencyId = data.replace("details_", "");
      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      const details = `
📋 *DETAILED INFORMATION*

*📍 Location:*
Name: ${emergency.location.name}
Building: ${emergency.location.building}
Floor: ${emergency.location.floor}
Address: ${emergency.location.address}

*⚠️ Alert:*
${emergency.sensorData.message}

*📊 All Readings:*
🌡️ Temperature: ${emergency.sensorData.temperature}°C
💧 Humidity: ${emergency.sensorData.humidity}%
💨 MQ2: ${emergency.sensorData.mq2} ppm
🔥 MQ4: ${emergency.sensorData.mq4} ppm
🔴 Flame: ${emergency.sensorData.flame ? "YES ⚠️" : "NO ✅"}

*⏰ Time:* ${emergency.detectedAt.toLocaleTimeString()}
*🆔 ID:* \`${emergencyId}\`

*✅ ACTION:* Use [✅ Accept & Going] if safe
      `;

      await helperBot.sendMessage(from.id, details, {
        parse_mode: "Markdown",
      });

      await helperBot.answerCallbackQuery(id, {
        text: "📋 Details sent",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // VIEW LOCATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("location_")) {
      const emergencyId = data.replace("location_", "");
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

      const locationMsg = `
📍 *Location Information*

*Facility:* ${emergency.location.name}
*Address:* ${emergency.location.address}

*GPS:*
Lat: ${emergency.location.coordinates.lat}
Lng: ${emergency.location.coordinates.lng}

📍 [Open in Maps](https://maps.google.com/?q=${emergency.location.coordinates.lat},${emergency.location.coordinates.lng})
      `;

      await helperBot.sendMessage(from.id, locationMsg, {
        parse_mode: "Markdown",
      });

      await helperBot.answerCallbackQuery(id, {
        text: "📍 Location sent",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ARRIVED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

👤 Helper: ${helperName}
📍 Location: ${emergency.location.name}

✅ Waiting for further action.
    `,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: "Markdown",
        },
      );

      // Notify MAIN BOT
      await mainBot.sendMessage(
        process.env.MAIN_CHAT_ID,
        `
🚗 *Helper 1 has arrived at the location.*

📍 ${emergency.location.name}
👤 ${helperName}
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RESOLVED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("resolved_")) {
      const emergencyId = data.replace("resolved_", "");
      const emergency = getEmergency(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      emergency.status = "resolved";
      emergency.resolvedAt = new Date();

      const responseTime = Math.floor(
        (emergency.resolvedAt - emergency.detectedAt) / 1000,
      );

      const resolvedMsg = `
✅ *EMERGENCY RESOLVED*

📍 ${emergency.location.name}
👤 Helper: ${helperName}

*⏱️ Response Time:* ${responseTime}s (${Math.floor(responseTime / 60)}m ${responseTime % 60}s)

Timeline:
Detection: ${emergency.detectedAt.toLocaleTimeString()}
Accepted: ${emergency.acceptedAt?.toLocaleTimeString() || "N/A"}
Arrived: ${emergency.arrivedAt?.toLocaleTimeString() || "N/A"}
Resolved: ${emergency.resolvedAt.toLocaleTimeString()}

✅ *Status: ALL CLEAR*
      `;

      await helperBot.editMessageText(resolvedMsg, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
      });

      // NOTIFY MAIN BOT
      await sendToMainBot(emergency, "RESOLVED");

      await helperBot.answerCallbackQuery(id, {
        text: "✅ Emergency resolved",
        show_alert: false,
      });
    }
  } catch (err) {
    console.error("❌ Error in callback:", err.message);
    try {
      await helperBot.answerCallbackQuery(id, {
        text: `❌ Error: ${err.message}`,
        show_alert: true,
      });
    } catch (e) {
      console.error("Could not send error response");
    }
  }
});

// ════════════════════════════════════════════════════════════
// SEND TO MAIN BOT
// ════════════════════════════════════════════════════════════

async function sendToMainBot(emergency, eventType) {
  const mainChatId = process.env.MAIN_CHAT_ID;

  if (!mainChatId) {
    console.log("⚠️  No MAIN_CHAT_ID - skipping main bot notification");
    return;
  }

  try {
    let notification = "";

    if (eventType === "ACCEPTED") {
      notification = `
✅ *EMERGENCY ACCEPTED*

👤 Helper: ${emergency.helperName}
🏠 Location: ${emergency.location.name}
⚠️ Alert: ${emergency.sensorData.message}

⏰ Response: ${Math.floor((emergency.acceptedAt - emergency.detectedAt) / 1000)}s
🚗 *ETA: 3-5 Minutes*

Helper is arriving now...
      `;
    } else if (eventType === "REJECTED") {
      notification = `
❌ *EMERGENCY REJECTED*

Helper: ${emergency.rejectedBy}
Location: ${emergency.location.name}

⚠️ Waiting for another helper...
      `;
    } else if (eventType === "ARRIVED") {
      notification = `
🚗 *HELPER ARRIVED*

Helper: ${emergency.helperName}
Location: ${emergency.location.name}
Arrival Time: ${emergency.arrivedAt.toLocaleTimeString()}

Now assessing the emergency...
      `;
    } else if (eventType === "RESOLVED") {
      const responseTime = Math.floor(
        (emergency.resolvedAt - emergency.detectedAt) / 1000,
      );

      notification = `
✅ *EMERGENCY FULLY RESOLVED*

Helper: ${emergency.helperName}
Location: ${emergency.location.name}

⏱️ Total Response Time: ${responseTime}s (${Math.floor(responseTime / 60)}m ${responseTime % 60}s)

✅ ALL SYSTEMS NORMAL
      `;
    }

    if (notification) {
      console.log(`   📢 Sending to main bot: ${eventType}`);
      await mainBot.sendMessage(mainChatId, notification, {
        parse_mode: "Markdown",
      });
      console.log(`   ✅ Main bot notified`);
    }
  } catch (err) {
    console.error("❌ Error sending to main bot:", err.message);
  }
}

// ════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ════════════════════════════════════════════════════════════

helperBot.on("message", async (msg) => {
  if (msg.text === "/start") {
    await helperBot.sendMessage(
      msg.chat.id,
      `✅ *Helper Bot Ready*

Your Chat ID: \`${msg.chat.id}\`

Add to .env:
\`HELPER_CHAT_ID=${msg.chat.id}\`

Waiting for emergency alerts...
Just click buttons! 🔘`,
      { parse_mode: "Markdown" },
    );
  }
});

helperBot.on("polling_error", (err) => {
  console.log("Polling error:", err.message);
});

// ════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════

module.exports = {
  sendEmergencyAlert,
  emergencyTracker,
};

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const notificationService = require("./notificationService");

const helperBot = new TelegramBot(process.env.HELPER_BOT_TOKEN, {
  polling: true,
});

console.log("✅ Helper bot started - INTERACTIVE BUTTONS VERSION");

// ════════════════════════════════════════════════════════════
// EMERGENCY TRACKER - Store all emergencies
// ════════════════════════════════════════════════════════════

const emergencyTracker = new Map();

// ════════════════════════════════════════════════════════════
// LOCATION DATABASE - Factory/Room details
// ════════════════════════════════════════════════════════════

const locationDatabase = {
  1: {
    name: "Factory A - Room 1",
    building: "Main Building",
    floor: "Ground Floor",
    address: "Industrial Zone, Sector 5, Mumbai",
    coordinates: { lat: 19.0176, lng: 72.8479 },
  },
  2: {
    name: "Factory A - Room 2",
    building: "Warehouse Building",
    floor: "First Floor",
    address: "Industrial Zone, Sector 5, Mumbai",
    coordinates: { lat: 19.0176, lng: 72.8479 },
  },
};

// ════════════════════════════════════════════════════════════
// SEND EMERGENCY ALERT - With interactive buttons
// ════════════════════════════════════════════════════════════

async function sendEmergencyAlert(roomId, sensorData) {
  const helperChatId = process.env.HELPER_CHAT_ID;

  if (!helperChatId) {
    console.log("❌ No helper chat ID in .env");
    return;
  }

  const location = locationDatabase[roomId] || {
    name: `Room ${roomId}`,
    address: "Unknown location",
  };

  // Create unique emergency ID
  const emergencyId = `EMG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  emergencyTracker.set(emergencyId, emergency);

  console.log(`\n🚨 EMERGENCY CREATED: ${emergencyId}`);
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

*⚠️ Alert Type:* ${sensorData.message}

*📊 Sensor Readings:*
🌡️ Temperature: ${sensorData.temperature}°C
💧 Humidity: ${sensorData.humidity}%
💨 MQ2 (Smoke/Gas): ${sensorData.mq2} ppm
🔥 MQ4 (Natural Gas): ${sensorData.mq4} ppm
🔴 Flame Detected: ${sensorData.flame ? "YES - FIRE RISK" : "NO"}

*🆔 Emergency ID:* \`${emergencyId}\`
*⏰ Time:* ${emergency.detectedAt.toLocaleTimeString()}

*📍 ACTION REQUIRED IMMEDIATELY!*
    `;

    await helperBot.sendMessage(helperChatId, message, {
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
      "✅ Emergency alert sent to helper bot with interactive buttons",
    );
    return emergencyId;
  } catch (err) {
    console.error("❌ Error sending emergency alert:", err);
  }
}

// ════════════════════════════════════════════════════════════
// CALLBACK QUERY HANDLER - Process button clicks
// ════════════════════════════════════════════════════════════

helperBot.on("callback_query", async (query) => {
  const { id, from, data, message } = query;
  const helperName = from.first_name || "Helper";

  console.log(`\n🔘 BUTTON CLICKED: ${data} by ${helperName}`);

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACCEPT EMERGENCY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

      emergency.status = "accepted";
      emergency.helperName = helperName;
      emergency.acceptedAt = new Date();

      // Edit original message
      const editMessage = `
✅ *EMERGENCY ACCEPTED*

*📍 Location:*
${emergency.location.name}
Building: ${emergency.location.building}
Floor: ${emergency.location.floor}
Address: ${emergency.location.address}

*👤 Helper:* ${helperName}
*⏰ Accepted At:* ${emergency.acceptedAt.toLocaleTimeString()}

*⏱️ ETA: 3-5 Minutes*
🚗 *Heading to your location now...*

*Status Options:*
      `;

      await helperBot.editMessageText(editMessage, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚗 Arrived at Location",
                callback_data: `arrived_${emergencyId}`,
              },
              {
                text: "✅ Issue Resolved",
                callback_data: `resolved_${emergencyId}`,
              },
            ],
            [
              {
                text: "⚠️ Need Backup",
                callback_data: `backup_${emergencyId}`,
              },
            ],
          ],
        },
      });

      // Send notification to main bot
      await notificationService.sendTelegramMessage(
        `✅ *EMERGENCY ACCEPTED*

👤 Helper: ${helperName}
🏠 Room: ${emergency.location.name}
⚠️ Alert: ${emergency.sensorData.message}
⏰ Response Time: ${Math.floor((emergency.acceptedAt - emergency.detectedAt) / 1000)}s
🚗 ETA: 3-5 minutes

_Helper is now en route to your location_`,
      );

      await helperBot.answerCallbackQuery(id, {
        text: "✅ Accepted! ETA 3-5 minutes",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // REJECT EMERGENCY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("reject_")) {
      const emergencyId = data.replace("reject_", "");
      const emergency = emergencyTracker.get(emergencyId);

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

*📍 Location:*
${emergency.location.name}
Building: ${emergency.location.building}

*👤 Helper:* ${helperName}
*Reason:* Unable to assist at this time

⚠️ Waiting for another helper to respond...
      `;

      await helperBot.editMessageText(editMessage, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
      });

      await notificationService.sendTelegramMessage(
        `❌ *EMERGENCY REJECTED*

Helper: ${helperName}
Location: ${emergency.location.name}

⚠️ Looking for alternative help...`,
      );

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
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      const detailsMessage = `
📋 *DETAILED EMERGENCY INFORMATION*

*🏢 Location Details:*
Name: ${emergency.location.name}
Building: ${emergency.location.building}
Floor: ${emergency.location.floor}
Address: ${emergency.location.address}
Coordinates: ${emergency.location.coordinates.lat}, ${emergency.location.coordinates.lng}

*⚠️ Alert Details:*
Alert: ${emergency.sensorData.message}

*📊 Complete Sensor Readings:*
🌡️ Temperature: ${emergency.sensorData.temperature}°C
💧 Humidity: ${emergency.sensorData.humidity}%
💨 MQ2 (Smoke/Gas): ${emergency.sensorData.mq2} ppm
🔥 MQ4 (Natural Gas): ${emergency.sensorData.mq4} ppm
🔴 Flame Detected: ${emergency.sensorData.flame ? "YES ⚠️" : "NO ✅"}

*🚨 RISK ASSESSMENT:*
${emergency.sensorData.mq2 > 350 ? "• MQ2 CRITICAL - Smoke/Flammable Gas detected" : ""}
${emergency.sensorData.mq4 > 1000 ? "• MQ4 CRITICAL - Natural Gas leak detected" : ""}
${emergency.sensorData.flame ? "• FLAME DETECTED - Fire hazard present" : ""}
${emergency.sensorData.temperature > 35 ? "• TEMPERATURE HIGH - Risk of equipment damage" : ""}

*✅ Action Steps:*
1. Review all readings above
2. Assess personal safety first
3. Use [✅ Accept & Going] if safe to handle
4. Follow emergency protocols
5. Contact facility manager if needed

*⏰ Detection Time:* ${emergency.detectedAt.toLocaleTimeString()}
*🆔 Emergency ID:* \`${emergency.id}\`
      `;

      await helperBot.sendMessage(from.id, detailsMessage, {
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
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) {
        await helperBot.answerCallbackQuery(id, {
          text: "❌ Emergency not found",
          show_alert: true,
        });
        return;
      }

      // Send location
      await helperBot.sendLocation(
        from.id,
        emergency.location.coordinates.lat,
        emergency.location.coordinates.lng,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📍 Open in Google Maps",
                  url: `https://maps.google.com/?q=${emergency.location.coordinates.lat},${emergency.location.coordinates.lng}`,
                },
              ],
            ],
          },
        },
      );

      const locationMessage = `
📍 *Location Information*

*Facility:* ${emergency.location.name}
*Building:* ${emergency.location.building}
*Floor:* ${emergency.location.floor}
*Full Address:* ${emergency.location.address}

*GPS Coordinates:*
Latitude: ${emergency.location.coordinates.lat}
Longitude: ${emergency.location.coordinates.lng}

*Navigation Instructions:*
✓ Use Google Maps link above for turn-by-turn navigation
✓ Inform facility gate about emergency situation
✓ Go directly to the room location
✓ Call facility manager when you arrive
✓ Check in with security
      `;

      await helperBot.sendMessage(from.id, locationMessage, {
        parse_mode: "Markdown",
      });

      await helperBot.answerCallbackQuery(id, {
        text: "📍 Location sent",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HELPER ARRIVED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("arrived_")) {
      const emergencyId = data.replace("arrived_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) return;

      emergency.status = "arrived";
      emergency.arrivedAt = new Date();

      const arrivedMessage = `
🚗 *HELPER ARRIVED AT LOCATION*

*👤 Helper:* ${helperName}
*📍 Location:* ${emergency.location.name}
*⏰ Arrival Time:* ${emergency.arrivedAt.toLocaleTimeString()}

*Current Status:*
Assessing situation...
Taking necessary safety precautions...
      `;

      await helperBot.editMessageText(arrivedMessage, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Issue Resolved",
                callback_data: `resolved_${emergencyId}`,
              },
              {
                text: "⚠️ Need Backup",
                callback_data: `backup_${emergencyId}`,
              },
            ],
          ],
        },
      });

      await notificationService.sendTelegramMessage(
        `🚗 *HELPER ARRIVED*

Helper: ${helperName}
Location: ${emergency.location.name}
Arrival Time: ${emergency.arrivedAt.toLocaleTimeString()}

Assessing and resolving the emergency...`,
      );

      await helperBot.answerCallbackQuery(id, {
        text: "✅ Arrival recorded",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ISSUE RESOLVED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("resolved_")) {
      const emergencyId = data.replace("resolved_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) return;

      emergency.status = "resolved";
      emergency.resolvedAt = new Date();

      const responseTime = Math.floor(
        (emergency.resolvedAt - emergency.detectedAt) / 1000,
      );

      const resolvedMessage = `
✅ *EMERGENCY RESOLVED*

*👤 Helper:* ${helperName}
*📍 Location:* ${emergency.location.name}

*⏱️ Response Timeline:*
Detection: ${emergency.detectedAt.toLocaleTimeString()}
Acceptance: ${emergency.acceptedAt?.toLocaleTimeString() || "N/A"}
Arrival: ${emergency.arrivedAt?.toLocaleTimeString() || "N/A"}
Resolution: ${emergency.resolvedAt.toLocaleTimeString()}

*Total Response Time:* ${responseTime}s (${Math.floor(responseTime / 60)}m ${responseTime % 60}s)

✅ *Status: ALL CLEAR*
Facility is safe to resume operations
      `;

      await helperBot.editMessageText(resolvedMessage, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
      });

      await notificationService.sendTelegramMessage(
        `✅ *EMERGENCY FULLY RESOLVED*

Helper: ${helperName}
Location: ${emergency.location.name}
Total Response Time: ${responseTime}s (${Math.floor(responseTime / 60)}m ${responseTime % 60}s)

✅ ALL SYSTEMS NORMAL - OPERATIONS CAN RESUME`,
      );

      await helperBot.answerCallbackQuery(id, {
        text: "✅ Emergency resolved",
        show_alert: false,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NEED BACKUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else if (data.startsWith("backup_")) {
      const emergencyId = data.replace("backup_", "");
      const emergency = emergencyTracker.get(emergencyId);

      if (!emergency) return;

      emergency.backupRequested = true;

      await notificationService.sendTelegramMessage(
        `🚨 *BACKUP REQUESTED*

Helper: ${helperName}
Location: ${emergency.location.name}
Alert: ${emergency.sensorData.message}

ADDITIONAL RESOURCES NEEDED IMMEDIATELY!
Sending backup units...`,
      );

      await helperBot.answerCallbackQuery(id, {
        text: "🚨 Backup request sent to management",
        show_alert: true,
      });
    }
  } catch (err) {
    console.error("❌ Error handling callback:", err);
    await helperBot.answerCallbackQuery(id, {
      text: "❌ Error processing request",
      show_alert: true,
    });
  }
});

// ════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ════════════════════════════════════════════════════════════

helperBot.on("message", async (msg) => {
  if (msg.text === "/start") {
    await helperBot.sendMessage(
      msg.chat.id,
      `✅ *Helper Bot Ready*

Your Chat ID: \`${msg.chat.id}\`

Put this in .env as:
\`HELPER_CHAT_ID=${msg.chat.id}\`

Waiting for emergency alerts with interactive buttons...

No more typing YES - just click buttons! 🔘`,
      { parse_mode: "Markdown" },
    );
  }
});

helperBot.on("polling_error", console.log);

// ════════════════════════════════════════════════════════════
// EXPORT FOR USE IN YOUR SENSOR CONTROLLER
// ════════════════════════════════════════════════════════════

module.exports = {
  sendEmergencyAlert,
  emergencyTracker,
};

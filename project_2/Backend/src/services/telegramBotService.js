// ─── Telegram Bot Listener ────────────────────────────────────
// Polls Telegram every 3 seconds for incoming messages.
//
// Commands people can send:
//   /start or /help        → welcome + instructions
//   /subscribe <password>  → subscribe with secret code
//   /unsubscribe           → stop receiving alerts
//   /status                → show system + subscription info
//   /info 1                → live sensor values for Room 1
//   /info 2                → live sensor values for Room 2
//   /info 3                → live sensor values for Room 3

const fetch = require("node-fetch");
const config = require("../config/notificationConfig");
const subscriberStore = require("../models/subscriberStore");
const alertTracker = require("../models/alertTracker");

// roomStore is required lazily to avoid circular dependency
let _roomStore = null;
function getRoomStore() {
  if (!_roomStore) _roomStore = require("../models/roomstore");
  return _roomStore;
}

const BASE = `https://api.telegram.org/bot${config.telegram.token}`;
let lastUpdate = 0;

// ── Send message to one specific chat ────────────────────────
async function sendTo(chatId, text) {
  try {
    await fetch(`${BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("[BOT] sendTo error:", err.message);
  }
}

// ── Format sensor level as emoji ─────────────────────────────
function _levelEmoji(level) {
  if (level === "danger") return "🔴";
  if (level === "warning") return "🟡";
  return "🟢";
}

// ── Build /info <roomId> response ────────────────────────────
// ─── Telegram Bot Listener ────────────────────────────────────
// Replace ONLY _buildRoomInfo(roomId) with this

function _buildRoomInfo(roomId) {
  const store = getRoomStore();
  const room = store.getRoom(roomId);

  // SAME professional offline message for both cases:
  // 1) no data yet
  // 2) device offline
  if (!room || !room.online) {
    return (
      `🚨 <b>ROOM ${roomId} OFFLINE — CRITICAL ALERT</b>\n` +
      `📍 Location: Room ${roomId}\n` +
      `🕐 ${new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })}\n\n` +
      `📵 No live sensor data available.\n` +
      `⚠️ Real-time monitoring has been interrupted.\n\n` +
      `🔌 Check ESP32 power supply.\n` +
      `📶 Verify WiFi / network connection.\n` +
      `🛠 Restart device if required.\n\n` +
      `⛑ Immediate action recommended.`
    );
  }

  const l = room.levels || {};

  const time = new Date(room.lastSeen).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const activeList = [];
  if (room.alerts?.fire) activeList.push("🔥 Flame detected");
  if (room.alerts?.mq2) activeList.push("💨 LPG / Smoke elevated");
  if (room.alerts?.mq4) activeList.push("⛽ Methane elevated");
  if (room.alerts?.temp) activeList.push("🌡 Temperature high");

  const alertSection = activeList.length
    ? `\n⚠️ <b>Active Alerts:</b>\n${activeList.map(a => `• ${a}`).join("\n")}`
    : `\n✅ All sensors normal`;

  return (
    `📊 <b>Room ${roomId} — Live Data</b>\n` +
    `🕐 Last update: ${time}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🌡 Temperature: ${_levelEmoji(l.temp)} <b>${room.temp?.toFixed(1)}°C</b>\n` +
    `💧 Humidity: ${_levelEmoji(l.humidity)} <b>${room.humidity?.toFixed(0)}%</b>\n` +
    `💨 MQ2 (LPG): ${_levelEmoji(l.mq2)} <b>${room.mq2}</b>\n` +
    `⛽ MQ4 (CH₄): ${_levelEmoji(l.mq4)} <b>${room.mq4}</b>\n` +
    `🔥 Flame: ${room.flame ? "🔴 <b>DETECTED</b>" : "🟢 None"}\n` +
    `🌬 Air Quality: <b>${room.airQuality || "Clean"}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━` +
    alertSection
  );
}

// ── Handle one incoming Telegram message ─────────────────────
async function handleMessage(msg) {
  const chatId = String(msg.chat.id);
  const raw = (msg.text || "").trim();
  const text = raw.toLowerCase();
  const name = msg.from?.first_name || "there";

  console.log(`[BOT] From ${chatId} (${name}): ${raw}`);

  // ── /start or /help ──────────────────────────────────────
  if (text === "/start" || text === "/help") {
    await sendTo(
      chatId,
      `👋 <b>Hello ${name}!</b>\n\n` +
        `This is <b>HazardWatch</b> — IoT Hazard Monitor Bot.\n\n` +
        `<b>Available Commands:</b>\n` +
        `<code>/subscribe &lt;password&gt;</code> — Subscribe to alerts\n` +
        `<code>/unsubscribe</code> — Stop receiving alerts\n` +
        `<code>/status</code> — System info + your subscription\n` +
        `<code>/info 1</code> — Live data for Room 1\n` +
        `<code>/info 2</code> — Live data for Room 2\n` +
        `<code>/info 3</code> — Live data for ALL ROOMS (combined)\n\n` +
        `<b>Features:</b>\n` +
        `✅ Real-time sensor alerts\n` +
        `📵 Offline detection with alerts\n` +
        `📊 Live data on demand\n\n` +
        `To start, type:\n<code>/subscribe ${config.subscribePassword}</code>`,
    );
    return;
  }

  // ── /subscribe <password> ────────────────────────────────
  if (text.startsWith("/subscribe")) {
    const parts = text.split(/\s+/);
    const password = parts[1] || "";

    if (password !== (config.subscribePassword || "system01").toLowerCase()) {
      await sendTo(
        chatId,
        `❌ <b>Wrong password.</b>\n\n` +
          `Ask the system admin for the correct password.\n` +
          `Usage: <code>/subscribe &lt;password&gt;</code>`,
      );
      return;
    }

    if (subscriberStore.has(chatId)) {
      await sendTo(
        chatId,
        `ℹ️ You are <b>already subscribed</b>.\n\n` +
          `You will receive alerts for all 3 rooms automatically.\n` +
          `Type <code>/info 1</code>, <code>/info 2</code>, or <code>/info 3</code> to check current data.`,
      );
      return;
    }

    subscriberStore.add(chatId);
    console.log(
      `[BOT] ✅ New subscriber: ${chatId} (${name}) — total: ${subscriberStore.count()}`,
    );

    await sendTo(
      chatId,
      `✅ <b>Subscribed successfully!</b>\n\n` +
        `Hello ${name}! You will now receive:\n` +
        `⚠️ Warnings when sensors enter warning state\n` +
        `🚨 Danger alerts when sensors enter critical state\n` +
        `📵 Offline alerts when any room ESP32 disconnects\n` +
        `✅ All clear when a room recovers\n\n` +
        `<b>Covers all 3 rooms.</b>\n\n` +
        `Check live data anytime:\n` +
        `<code>/info 1</code>  •  <code>/info 2</code>  •  <code>/info 3</code>\n\n` +
        `Type <code>/unsubscribe</code> to stop alerts.`,
    );
    return;
  }

  // ── /unsubscribe ─────────────────────────────────────────
  if (text === "/unsubscribe") {
    if (!subscriberStore.has(chatId)) {
      await sendTo(
        chatId,
        `ℹ️ You are not currently subscribed.\nType <code>/subscribe &lt;password&gt;</code> to start.`,
      );
      return;
    }
    subscriberStore.remove(chatId);
    console.log(`[BOT] ❌ Unsubscribed: ${chatId} (${name})`);
    await sendTo(
      chatId,
      `👋 <b>Unsubscribed successfully.</b>\n\n` +
        `You will no longer receive hazard alerts.\n` +
        `Type <code>/subscribe &lt;password&gt;</code> anytime to re-enable.`,
    );
    return;
  }

  // ── /status ──────────────────────────────────────────────
  if (text === "/status") {
    const store = getRoomStore();
    const rooms = store.getAllRooms(3);
    const subCount = subscriberStore.count();
    const isSubbed = subscriberStore.has(chatId);

    const roomLines = rooms
      .map((r) => {
        if (!r.online) return `  📵 Room ${r.room}: Offline`;
        const status =
          r.overallStatus === "danger"
            ? "🔴 DANGER"
            : r.overallStatus === "warning"
              ? "🟡 WARNING"
              : "🟢 Safe";
        return `  Room ${r.room}: ${status}`;
      })
      .join("\n");

    await sendTo(
      chatId,
      `📊 <b>HazardWatch — System Status</b>\n` +
        `🕐 ${new Date().toLocaleString("en-IN")}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `<b>Rooms:</b>\n${roomLines}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👥 Total subscribers: <b>${subCount}</b>\n` +
        `🔔 Your alerts: ${isSubbed ? "Enabled ✅" : "Disabled ❌"}\n\n` +
        `Check room details:\n` +
        `<code>/info 1</code>  •  <code>/info 2</code>  •  <code>/info 3</code>`,
    );
    return;
  }

  // ── /info <roomId> — handles "info 1", "info 2", "info 3" ─
  // Also accepts "/system info 1" or just "info 1" for flexibility
  // ── /info <roomId> ───────────────────────────────────────
  // ── /info <roomId> ───────────────────────────────────────────
  const infoMatch = text.match(/^\/info\s+([1-3])$/);
  if (infoMatch) {
    const roomId = parseInt(infoMatch[1]);

    // Special case: /info 3 shows ALL rooms in one message
    if (roomId === 3) {
      const store = getRoomStore();
      const allRooms = store.getAllRooms(2); // Get rooms 1 & 2

      const combinedMsg = _buildCombinedRoomsInfo(allRooms);
      await sendTo(chatId, combinedMsg);
    } else {
      // /info 1 or /info 2 — show individual room
      await sendTo(chatId, _buildRoomInfo(roomId));
    }
    return;
  }

  // ── New function: Build combined info for all rooms ─────────────
  // function _buildCombinedRoomsInfo(allRooms) {
  //   let msg = `📊 <b>ALL ROOMS — Live Data Summary</b>\n`;
  //   msg += `🕐 ${new Date().toLocaleTimeString("en-IN", {
  //     timeZone: "Asia/Kolkata",
  //     hour: "2-digit",
  //     minute: "2-digit",
  //     second: "2-digit",
  //     hour12: true,
  //   })}\n`;
  //   msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  //   for (const room of allRooms) {
  //     if (!room.online) {
  //       msg += `🚨 <b>ROOM ${room.room} — OFFLINE</b>\n`;
  //       msg += `📵 No data received yet\n`;
  //       msg += `⚠️ Check ESP32 connectivity\n\n`;
  //     } else {
  //       const l = room.levels || {};
  //       const time = new Date(room.lastSeen).toLocaleTimeString("en-IN", {
  //         timeZone: "Asia/Kolkata",
  //         hour: "2-digit",
  //         minute: "2-digit",
  //         second: "2-digit",
  //         hour12: true,
  //       });

  //       const activeAlerts = [];
  //       if (room.alerts?.fire) activeAlerts.push("🔥 Flame detected");
  //       if (room.alerts?.mq2) activeAlerts.push("💨 LPG elevated");
  //       if (room.alerts?.mq4) activeAlerts.push("⛽ Methane elevated");
  //       if (room.alerts?.temp) activeAlerts.push("🌡 Temp high");

  //       const statusEmoji =
  //         room.overallStatus === "danger"
  //           ? "🔴"
  //           : room.overallStatus === "warning"
  //             ? "🟡"
  //             : "🟢";

  //       msg += `📊 <b>ROOM ${room.room}</b> — ${statusEmoji} ${room.overallStatus.toUpperCase()}\n`;
  //       msg += `🕐 ${time}\n`;
  //       msg += `🌡 Temp: ${_levelEmoji(l.temp)} <b>${room.temp?.toFixed(1)}°C</b>  `;
  //       msg += `💧 Humidity: ${_levelEmoji(l.humidity)} <b>${room.humidity?.toFixed(0)}%</b>\n`;
  //       msg += `💨 MQ2: ${_levelEmoji(l.mq2)} <b>${room.mq2}</b>  `;
  //       msg += `⛽ MQ4: ${_levelEmoji(l.mq4)} <b>${room.mq4}</b>\n`;
  //       msg += `🔥 Flame: ${room.flame ? "🔴 <b>DETECTED</b>" : "🟢 None"}\n`;

  //       if (activeAlerts.length > 0) {
  //         msg += `⚠️ <b>Active Alerts:</b> ${activeAlerts.join(" | ")}\n`;
  //       }
  //       msg += `\n`;
  //     }
  //   }

  //   msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  //   msg += `💡 Details: /info 1  •  /info 2`;

  //   return msg;
  // }

  function _buildRoomInfo(roomId) {
    const store = getRoomStore();

    // ROOM 3 = SHOW ALL ROOMS
    if (roomId === 3) {
      const rooms = store.getAllRooms(3);

      let msg = `📊 <b>ALL ROOMS STATUS</b>
`;
      msg += `━━━━━━━━━━━━━━━━━━━
`;

      rooms.forEach((room) => {
        if (!room.online) {
          msg += `
🚨 Room ${room.room}: OFFLINE
`;
          return;
        }

        msg +=
          `
🏠 <b>Room ${room.room}</b>
` +
          `🌡 Temp: ${room.temp}°C
` +
          `💧 Humidity: ${room.humidity}%
` +
          `💨 MQ2: ${room.mq2}
` +
          `⛽ MQ4: ${room.mq4}
` +
          `🔥 Flame: ${room.flame ? "Detected" : "None"}
` +
          `📡 Status: ${room.overallStatus.toUpperCase()}
`;
      });

      return msg;
    }

    // SINGLE ROOM
    const room = store.getRoom(roomId);

    if (!room || !room.online) {
      return `🚨 Room ${roomId} is OFFLINE`;
    }

    return (
      `📊 <b>Room ${roomId}</b>
` +
      `🌡 Temp: ${room.temp}°C
` +
      `💧 Humidity: ${room.humidity}%
` +
      `💨 MQ2: ${room.mq2}
` +
      `⛽ MQ4: ${room.mq4}
` +
      `🔥 Flame: ${room.flame ? "Detected" : "None"}
` +
      `📡 Status: ${room.overallStatus.toUpperCase()}`
    );
  }

  // ── Unknown command ───────────────────────────────────────
  await sendTo(
    chatId,
    `❓ Unknown command: <code>${raw}</code>\n\n` +
      `Type /help to see all available commands.`,
  );
}

// ── Long polling loop ─────────────────────────────────────────
// ── Long polling loop ─────────────────────────────────────────
async function startPolling() {
  if (!config.telegram.enabled) {
    console.log("[BOT] Telegram disabled in config — skipping");
    return;
  }

  console.log("[BOT] 🤖 Telegram bot started — polling for messages...");

  // ← ADD THIS: skip all old messages on startup
  try {
    const url = `https://api.telegram.org/bot${config.telegram.token}/getUpdates?offset=-1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      lastUpdate = data.result[data.result.length - 1].update_id;
      console.log(`[BOT] Skipped old messages, starting from update: ${lastUpdate}`);
    }
  } catch (err) {}

  async function poll() {
    try {
      const url = `https://api.telegram.org/bot${config.telegram.token}/getUpdates?offset=${lastUpdate + 1}&timeout=2`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdate = update.update_id;
          if (update.message) {
            await handleMessage(update.message);
          }
        }
      }
    } catch (err) {}

    setTimeout(poll, 3000);
  }

  poll();
}

module.exports = { startPolling, sendTo };

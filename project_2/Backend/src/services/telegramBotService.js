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
function _buildRoomInfo(roomId) {
  const store = getRoomStore();
  const room = store.getRoom(roomId);

  if (!room) {
    return `📵 <b>Room ${roomId}</b> — No data received yet.\nMake sure ESP32 for Room ${roomId} is powered on and connected.`;
  }

  if (!room.online) {
    return `📵 <b>Room ${roomId} — OFFLINE</b>\nLast data was received more than 10 seconds ago.\nCheck ESP32 power and WiFi.`;
  }

  const l = room.levels || {};
  const time = new Date(room.lastSeen).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Build active alerts list
  const activeList = [];
  if (room.alerts?.fire) activeList.push("🔥 Flame detected");
  if (room.alerts?.mq2) activeList.push("💨 LPG/Smoke elevated");
  if (room.alerts?.mq4) activeList.push("⛽ Methane elevated");
  if (room.alerts?.temp) activeList.push("🌡️ Temperature high");

  const alertSection = activeList.length
    ? `\n⚠️ <b>Active Alerts:</b>\n${activeList.map((a) => `  • ${a}`).join("\n")}`
    : "\n✅ All sensors normal";

  return (
    `📊 <b>Room ${roomId} — Live Data</b>\n` +
    `🕐 Last update: ${time}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🌡 Temperature:  ${_levelEmoji(l.temp)}  <b>${room.temp?.toFixed(1) ?? "--"}°C</b>\n` +
    `💧 Humidity:     ${_levelEmoji(l.humidity)}  <b>${room.humidity?.toFixed(0) ?? "--"}%</b>\n` +
    `💨 MQ2 (LPG):    ${_levelEmoji(l.mq2)}  <b>${room.mq2 ?? "--"}</b>\n` +
    `⛽ MQ4 (CH₄):    ${_levelEmoji(l.mq4)}  <b>${room.mq4 ?? "--"}</b>\n` +
    `🔥 Flame:        ${room.flame ? "🔴 <b>DETECTED</b>" : "🟢 None"}\n` +
    `🌬 Air Quality:  <b>${room.airQuality ?? "--"}</b>\n` +
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
        `<code>/info 3</code> — Live data for Room 3\n\n` +
        `To start, type:\n<code>/subscribe ${config.subscribePassword}</code>`,
    );
    return;
  }

  // ── /subscribe <password> ────────────────────────────────
  if (text.startsWith("/subscribe")) {
    const parts = text.split(/\s+/);
    const password = parts[1] || "";

    if (password !== config.subscribePassword.toLowerCase()) {
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
  const infoMatch =
    text.match(/\/info\s+([1-3])/) ||
    text.match(/(?:system\s+)?info\s+([1-3])/);
  if (infoMatch) {
    const roomId = parseInt(infoMatch[1]);
    await sendTo(chatId, _buildRoomInfo(roomId));
    return;
  }

  // ── Unknown command ───────────────────────────────────────
  await sendTo(
    chatId,
    `❓ Unknown command: <code>${raw}</code>\n\n` +
      `Type /help to see all available commands.`,
  );
}

// ── Long polling loop ─────────────────────────────────────────
async function startPolling() {
  if (!config.telegram.enabled) {
    console.log("[BOT] Telegram disabled in config — skipping");
    return;
  }

  console.log("[BOT] 🤖 Telegram bot started — polling for messages...");

  async function poll() {
    try {
      const url = `${BASE}/getUpdates?offset=${lastUpdate + 1}&timeout=2`;
      const res = await fetch(url);
      const data = await res.json();
      console.log("[BOT] Response:", JSON.stringify(data)); // ← ADD THIS

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdate = update.update_id;
          if (update.message) {
            await handleMessage(update.message);
          }
        }
      }
    } catch (err) {
      // Ignore transient network errors — keep polling
      console.error("[BOT] Poll error:", err.message); // ← CHANGE THIS
    }

    setTimeout(poll, 3000);
  }

  poll();
}

module.exports = { startPolling, sendTo };

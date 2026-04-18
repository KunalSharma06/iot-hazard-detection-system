// ─── Notification Service ─────────────────────────────────────
// Broadcasts alerts to ALL Telegram subscribers.
// Supports two severity levels:
//   warning → yellow ⚠️  "check it, not urgent"
//   danger  → red 🚨  "take action immediately"

const fetch = require("node-fetch");
const config = require("../config/notificationConfig");
const subscriberStore = require("../models/subscriberStore");

const BASE = `https://api.telegram.org/bot${config.telegram.token}`;

// ── Send to one chat ID ───────────────────────────────────────
async function _sendOne(chatId, text) {
  try {
    const res = await fetch(`${BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`[TELEGRAM] Failed for ${chatId}: ${data.description}`);
    }
  } catch (err) {
    console.error(`[TELEGRAM] Network error for ${chatId}:`, err.message);
  }
}

// ── Broadcast to all subscribers ─────────────────────────────
async function _broadcast(text) {
  if (!config.telegram.enabled) return;

  const all = subscriberStore.getAll();
  console.log("Subscribers:", all);
  if (all.length === 0) {
    console.log("[NOTIFY] No subscribers — skipping");
    return;
  }

  console.log(`[NOTIFY] Broadcasting to ${all.length} subscriber(s)`);
  await Promise.all(all.map((chatId) => _sendOne(chatId, text)));
}

// ── Shared helpers ────────────────────────────────────────────
function _time() {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// Room name with number, e.g. "Room 1"
function _room(roomId) {
  return `Room ${roomId}`;
}

// ── Message templates — WARNING level (yellow) ────────────────
// Warning = sensor crossed warn threshold but NOT danger threshold
const WARNING_TEMPLATES = {
  flame: (roomId, data) =>
    `⚠️ <b>FLAME WARNING</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `🕐 ${_time()}\n\n` +
    `Flame sensor triggered in ${_room(roomId)}.\n` +
    `Please check the area — could be a false alarm or early fire.`,

  mq2: (roomId, data) =>
    `⚠️ <b>LPG / SMOKE — WARNING</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `📊 MQ2 Reading: <b>${data.mq2}</b>  (warn threshold: ${data._thresholds?.mq2?.warn ?? "—"})\n` +
    `🕐 ${_time()}\n\n` +
    `Gas level is elevated in ${_room(roomId)}.\n` +
    `Check for gas leak or poor ventilation.`,

  mq4: (roomId, data) =>
    `⚠️ <b>METHANE / CNG — WARNING</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `📊 MQ4 Reading: <b>${data.mq4}</b>  (warn threshold: ${data._thresholds?.mq4?.warn ?? "—"})\n` +
    `🕐 ${_time()}\n\n` +
    `Methane level rising in ${_room(roomId)}.\n` +
    `Check gas lines and appliances.`,

  temp: (roomId, data) =>
    `⚠️ <b>TEMPERATURE — WARNING</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `🌡 Temp: <b>${data.temp}°C</b>  💧 Humidity: ${data.humidity}%\n` +
    `🕐 ${_time()}\n\n` +
    `Temperature is above normal in ${_room(roomId)}.\n` +
    `Monitor the area — cooling may be needed.`,
};

// ── Message templates — DANGER level (red) ───────────────────
// Danger = sensor crossed danger threshold — immediate action needed
const DANGER_TEMPLATES = {
  flame: (roomId, data) =>
    `🚨 <b>FLAME DETECTED — DANGER!</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `🕐 ${_time()}\n\n` +
    `🔥 <b>Fire detected in ${_room(roomId)}!</b>\n` +
    `⛑ Evacuate immediately and call emergency services!`,

  mq2: (roomId, data) =>
    `🚨 <b>LPG / SMOKE — DANGER!</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `📊 MQ2 Reading: <b>${data.mq2}</b>  (danger threshold: ${data._thresholds?.mq2?.danger ?? "—"})\n` +
    `🕐 ${_time()}\n\n` +
    `💨 <b>Dangerous gas level in ${_room(roomId)}!</b>\n` +
    `⛑ Ventilate immediately — risk of explosion or suffocation!`,

  mq4: (roomId, data) =>
    `🚨 <b>METHANE / CNG — DANGER!</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `📊 MQ4 Reading: <b>${data.mq4}</b>  (danger threshold: ${data._thresholds?.mq4?.danger ?? "—"})\n` +
    `🕐 ${_time()}\n\n` +
    `⛽ <b>Critical methane level in ${_room(roomId)}!</b>\n` +
    `⛑ Turn off gas supply — risk of explosion!`,

  temp: (roomId, data) =>
    `🚨 <b>TEMPERATURE — DANGER!</b>\n` +
    `📍 ${_room(roomId)}\n` +
    `🌡 Temp: <b>${data.temp}°C</b>  💧 Humidity: ${data.humidity}%\n` +
    `🕐 ${_time()}\n\n` +
    `🌡️ <b>Critical temperature in ${_room(roomId)}!</b>\n` +
    `⛑ Check for fire or equipment failure immediately!`,
};

// ── Offline and all-clear templates ──────────────────────────
const SYSTEM_TEMPLATES = {
  offline: (roomId) =>
    `🚨 <b>ROOM ${roomId} OFFLINE — CRITICAL ALERT</b>\n` +
    `📵 No sensor data received for more than 30 seconds.\n` +
    `📍 Location: Room ${roomId}\n` +
    `🕐 ${_time()}\n\n` +
    `⚠️ Real-time monitoring has been interrupted.\n` +
    `🔌 Check ESP32 power supply immediately.\n` +
    `📶 Verify WiFi/network connectivity.\n` +
    `🛠 Inspect device status and restart if required.\n\n` +
    `⛑ Immediate action recommended to restore monitoring.`,

  allClear: (roomId) =>
    `✅ <b>ALL CLEAR — ${_room(roomId)}</b>\n` +
    `📍 Location: ${_room(roomId)}\n` +
    `🕐 ${_time()}\n\n` +
    `All sensor readings have returned to normal ranges.\n` +
    `🟢 Monitoring status restored.\n` +
    `🛡 Environment is now safe and stable.`,
};

// ── Public API ────────────────────────────────────────────────

// Called by sensorController — level is 'warning' or 'danger'
async function sendAlert(roomId, alertKey, sensorData, level = "danger") {
  const templates = level === "warning" ? WARNING_TEMPLATES : DANGER_TEMPLATES;
  const template = templates[alertKey];
  if (template) await _broadcast(template(roomId, sensorData));
}

async function sendAllClear(roomId) {
  await _broadcast(SYSTEM_TEMPLATES.allClear(roomId));
}

async function sendOfflineAlert(roomId) {
  await _broadcast(SYSTEM_TEMPLATES.offline(roomId));
}

module.exports = { sendAlert, sendAllClear, sendOfflineAlert };

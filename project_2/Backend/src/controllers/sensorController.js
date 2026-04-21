const roomStore = require("../models/roomstore");
const notificationService = require("../services/notificationService");
const thresholds = require("../config/threshold");

const prevState = {};
const cooldown = {};

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);
    const room = saved.room;

    console.log(
      `[DATA] Room ${room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame} Status:${saved.overallStatus}`,
    );

    // ── Current LEVEL state (not just true/false) ────────
    const current = {
      mq2: getLevel(saved.mq2, thresholds.mq2.warn, thresholds.mq2.danger),
      mq4: getLevel(saved.mq4, thresholds.mq4.warn, thresholds.mq4.danger),
      temp: getLevel(
        saved.temp,
        thresholds.temperature.warn,
        thresholds.temperature.danger,
      ),
      flame: saved.flame === true ? "danger" : "safe",
    };

    // ── Previous state (all safe on first data) ──────────
    const prev = prevState[room] || {
      mq2: "safe",
      mq4: "safe",
      temp: "safe",
      flame: "safe",
    };

    // ── MQ2 ──────────────────────────────────────────────
    if (current.mq2 !== "safe" && prev.mq2 !== current.mq2) {
      await sendIfReady(room, "mq2", saved, current.mq2);
    }

    // ── MQ4 ──────────────────────────────────────────────
    if (current.mq4 !== "safe" && prev.mq4 !== current.mq4) {
      await sendIfReady(room, "mq4", saved, current.mq4);
    }

    // ── TEMP ─────────────────────────────────────────────
    if (current.temp !== "safe" && prev.temp !== current.temp) {
      await sendIfReady(room, "temp", saved, current.temp);
    }

    // ── FLAME ────────────────────────────────────────────
    if (current.flame === "danger" && prev.flame !== "danger") {
      await sendIfReady(room, "flame", saved, "danger");
    }

    // ── ALL CLEAR — any alert → all safe ─────────────────
    const wasAnyAlert =
      prev.mq2 !== "safe" ||
      prev.mq4 !== "safe" ||
      prev.temp !== "safe" ||
      prev.flame !== "safe";
    const nowAllSafe =
      current.mq2 === "safe" &&
      current.mq4 === "safe" &&
      current.temp === "safe" &&
      current.flame === "safe";

    if (wasAnyAlert && nowAllSafe) {
      await sendIfReady(room, "allclear", saved, "safe");
    }

    // ── Save current state ────────────────────────────────
    prevState[room] = current;

    res.status(200).json({ ok: true, status: saved.overallStatus });
  } catch (err) {
    next(err);
  }
}

// Returns "safe", "warning", or "danger"
function getLevel(value, warnAt, dangerAt) {
  if (value >= dangerAt) return "danger";
  if (value >= warnAt) return "warning";
  return "safe";
}

async function sendIfReady(room, key, saved, level) {
  const id = `${room}_${key}`;
  const now = Date.now();
  if (cooldown[id] && now - cooldown[id] < 60000) return;

  if (key === "allclear") {
    await notificationService.sendAllClear(room);
  } else {
    await notificationService.sendAlert(
      room,
      key,
      { ...saved, _thresholds: thresholds },
      level,
    );
  }
  cooldown[id] = now;
}

module.exports = { receiveData };

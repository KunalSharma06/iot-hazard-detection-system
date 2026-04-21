const roomStore = require("../models/roomstore");
const notificationService = require("../services/notificationService");
const thresholds = require("../config/threshold");

// Track previous alert state per room to detect changes
const prevState = {};
// Cooldown tracker
const cooldown = {};

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);
    const room = saved.room;

    console.log(
      `[DATA] Room ${room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame} Status:${saved.overallStatus}`,
    );

    // Current alert state
    const current = {
      mq2: saved.mq2 >= thresholds.mq2.warn,
      mq4: saved.mq4 >= thresholds.mq4.warn,
      temp: saved.temp >= thresholds.temperature.warn,
      flame: saved.flame === true,
    };

    // Previous state (default all false on first data)
    const prev = prevState[room] || {
      mq2: false,
      mq4: false,
      temp: false,
      flame: false,
    };

    // ── Send alert only when state changes false → true ──
    if (!prev.mq2 && current.mq2) {
      const level = saved.mq2 >= thresholds.mq2.danger ? "danger" : "warning";
      await sendIfReady(room, "mq2", saved, level);
    }
    if (!prev.mq4 && current.mq4) {
      const level = saved.mq4 >= thresholds.mq4.danger ? "danger" : "warning";
      await sendIfReady(room, "mq4", saved, level);
    }
    if (!prev.temp && current.temp) {
      const level =
        saved.temp >= thresholds.temperature.danger ? "danger" : "warning";
      await sendIfReady(room, "temp", saved, level);
    }
    if (!prev.flame && current.flame) {
      await sendIfReady(room, "flame", saved, "danger");
    }

    // ── Send ALL CLEAR only when going from any alert → all safe ──
    const wasAnyAlert = prev.mq2 || prev.mq4 || prev.temp || prev.flame;
    const nowAllSafe =
      !current.mq2 && !current.mq4 && !current.temp && !current.flame;

    if (wasAnyAlert && nowAllSafe) {
      await sendIfReady(room, "allclear", saved, "safe");
    }

    // Save current state
    prevState[room] = current;

    res.status(200).json({ ok: true, status: saved.overallStatus });
  } catch (err) {
    next(err);
  }
}

async function sendIfReady(room, key, saved, level) {
  const id = `${room}_${key}`;
  const now = Date.now();
  if (cooldown[id] && now - cooldown[id] < 60000) return; // 60s cooldown

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

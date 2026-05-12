// ════════════════════════════════════════════════════════════
// UPDATED sensorController.js - Integration with new helper bot
// ════════════════════════════════════════════════════════════

const roomStore = require("../models/roomstore");
const notificationService = require("../services/notificationService");
const thresholds = require("../config/threshold");
const alertTracker = require("../models/alertTracker");
const emergencyService = require("../services/emergencyService");

const prevState = {};

// ════════════════════════════════════════════════════════════
// OFFLINE DETECTION - Track last update time for each room
// ════════════════════════════════════════════════════════════

const lastUpdate = {};
const offlineAlerted = {};

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);
    const room = saved.room;

    // ✅ UPDATE TIMESTAMP WHEN DATA RECEIVED
    lastUpdate[room] = Date.now();
    offlineAlerted[room] = false; // Room came back online

    console.log(
      `[DATA] Room ${room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame}`,
    );

    // ── Current LEVEL state ──────────────────────────────
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

    // ── Previous state ───────────────────────────────────
    const prev = prevState[room] || {
      mq2: "safe",
      mq4: "safe",
      temp: "safe",
      flame: "safe",
    };

    // ── MQ2 — send on ANY level change ───────────────────
    if (current.mq2 !== prev.mq2) {
      if (current.mq2 !== "safe") {
        await notificationService.sendAlert(
          room,
          "mq2",
          { ...saved, _thresholds: thresholds },
          current.mq2,
        );

        // SEND INTERACTIVE EMERGENCY ALERT
        if (current.mq2 === "danger") {
          await emergencyService.startEmergency(room, saved);
        }
      }
    }

    // ── MQ4 — send on ANY level change ───────────────────
    if (current.mq4 !== prev.mq4) {
      if (current.mq4 !== "safe") {
        await notificationService.sendAlert(
          room,
          "mq4",
          { ...saved, _thresholds: thresholds },
          current.mq4,
        );

        // SEND INTERACTIVE EMERGENCY ALERT
        if (current.mq4 === "danger") {
          await emergencyService.startEmergency(room, saved);
        }
      }
    }

    // ── TEMP — send on ANY level change ──────────────────
    if (current.temp !== prev.temp) {
      if (current.temp !== "safe") {
        await notificationService.sendAlert(
          room,
          "temp",
          { ...saved, _thresholds: thresholds },
          current.temp,
        );

        // SEND INTERACTIVE EMERGENCY ALERT FOR DANGEROUS TEMP
        if (current.temp === "danger") {
          await emergencyService.startEmergency(room, saved);
        }
      }
    }

    // ── FLAME — send when detected ───────────────────────
    if (current.flame === "danger" && prev.flame !== "danger") {
      await notificationService.sendAlert(
        room,
        "flame",
        { ...saved, _thresholds: thresholds },
        "danger",
      );

      // SEND INTERACTIVE EMERGENCY ALERT - FIRE DETECTED
      await emergencyService.startEmergency(room, saved);
    }

    // ── ALL CLEAR — when all go back to safe ─────────────
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
      await notificationService.sendAllClear(room);
    }

    // ── Save current state ────────────────────────────────
    prevState[room] = current;

    res.status(200).json({ ok: true, status: saved.overallStatus });
  } catch (err) {
    next(err);
  }
}

function getLevel(value, warnAt, dangerAt) {
  if (value >= dangerAt) return "danger";
  if (value >= warnAt) return "warning";
  return "safe";
}

// ════════════════════════════════════════════════════════════
// PERIODIC OFFLINE CHECK - Every 10 seconds
// ════════════════════════════════════════════════════════════

setInterval(() => {
  const now = Date.now();
  const OFFLINE_TIMEOUT = 30000; // 30 seconds

  for (let roomId = 1; roomId <= 3; roomId++) {
    const lastTime = lastUpdate[roomId];

    if (lastTime) {
      const timeSinceLastUpdate = now - lastTime;

      // If no data for 30+ seconds
      if (timeSinceLastUpdate > OFFLINE_TIMEOUT) {
        // Only send alert ONCE per offline event
        if (!offlineAlerted[roomId]) {
          console.log(
            `🚨 Room ${roomId} OFFLINE! Last update: ${timeSinceLastUpdate}ms ago`,
          );
          notificationService.sendOfflineAlert(roomId); // ← SENDS TO ALL SUBSCRIBERS
          offlineAlerted[roomId] = true; // Mark as alerted
        }
      } else {
        // Room is back online
        if (offlineAlerted[roomId]) {
          console.log(`✅ Room ${roomId} back ONLINE`);
          notificationService.sendAllClear(roomId);
          offlineAlerted[roomId] = false;
        }
      }
    }
  }
}, 10000); // Check every 10 seconds

module.exports = { receiveData };

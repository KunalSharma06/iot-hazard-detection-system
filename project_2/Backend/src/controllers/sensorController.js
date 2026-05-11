const roomStore = require("../models/roomstore");
const notificationService = require("../services/notificationService");
const thresholds = require("../config/threshold");

// At the top of your file
const alertTracker = require("../models/alertTracker");
const emergencyService = require("../services/emergencyService");

// Add this function to check offline status
async function monitorOfflineStatus(roomId) {
  const room = roomStore.getRoom(roomId);
  const isCurrentlyOffline = !room || (Date.now() - room.lastSeen > thresholds.offlineAfterSeconds * 1000);
  
  // This tracks state and returns true ONLY on transition: online → offline
  const justWentOffline = alertTracker.setOffline(roomId, isCurrentlyOffline);
  
  if (justWentOffline) {
    console.log(`[OFFLINE ALERT] Room ${roomId} is now OFFLINE`);
    await notificationService.sendOfflineAlert(roomId);
  }
}

// Call monitorOfflineStatus(roomId) periodically in your main loop
// Example: every 5 seconds check each room
setInterval(async () => {
  for (let roomId = 1; roomId <= 2; roomId++) {
    await monitorOfflineStatus(roomId);
  }
}, 5000);

const prevState = {};

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);
    const room = saved.room;

    console.log(
      `[DATA] Room ${room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame} Status:${saved.overallStatus}`,
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

        if (current.mq2 === "danger") {
          await emergencyService.startEmergency(room);
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
         if (current.mq4 === "danger") {
           await emergencyService.startEmergency(room);
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
      await emergencyService.startEmergency(room);
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

module.exports = { receiveData };

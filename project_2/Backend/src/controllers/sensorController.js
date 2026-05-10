const roomStore = require("../models/roomstore");
const notificationService = require("../services/notificationService");
const thresholds = require("../config/threshold");
const alertTracker = require("../models/alertTracker");

// ─────────────────────────────────────────────────────────────
// OFFLINE MONITOR
// ─────────────────────────────────────────────────────────────

async function monitorOfflineStatus(roomId) {
  const room = roomStore.getRoom(roomId);

  // if no room data yet → offline
  const isCurrentlyOffline =
    !room ||
    Date.now() - room.lastSeen >
      thresholds.offlineAfterSeconds * 1000;

  // returns TRUE only when ONLINE -> OFFLINE
  const justWentOffline = alertTracker.setOffline(
    roomId,
    isCurrentlyOffline,
  );

  if (justWentOffline) {
    console.log(`[OFFLINE ALERT] Room ${roomId} is OFFLINE`);
    await notificationService.sendOfflineAlert(roomId);
  }
}

// IMPORTANT:
// only ONE interval should exist
if (!global.offlineMonitorStarted) {
  global.offlineMonitorStarted = true;

  setInterval(async () => {
    for (let roomId = 1; roomId <= 3; roomId++) {
      await monitorOfflineStatus(roomId);
    }
  }, 5000);
}

// ─────────────────────────────────────────────────────────────
// PREVIOUS SENSOR STATE
// ─────────────────────────────────────────────────────────────

const prevState = {};

function getLevel(value, warnAt, dangerAt) {
  if (value >= dangerAt) return "danger";
  if (value >= warnAt) return "warning";
  return "safe";
}

// ─────────────────────────────────────────────────────────────
// RECEIVE SENSOR DATA
// ─────────────────────────────────────────────────────────────

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);
    const room = saved.room;

    // VERY IMPORTANT:
    // mark room ONLINE again when data received
    alertTracker.setOffline(room, false);
    console.log(
      `[DATA] Room ${room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame}`,
    );

    const current = {
      mq2: getLevel(saved.mq2, thresholds.mq2.warn, thresholds.mq2.danger),
      mq4: getLevel(saved.mq4, thresholds.mq4.warn, thresholds.mq4.danger),
      temp: getLevel(
        saved.temp,
        thresholds.temperature.warn,
        thresholds.temperature.danger,
      ),
      flame: saved.flame ? "danger" : "safe",
    };

    const prev = prevState[room] || {
      mq2: "safe",
      mq4: "safe",
      temp: "safe",
      flame: "safe",
    };

    if (current.mq2 !== prev.mq2) {
      if (current.mq2 !== "safe") {
        await notificationService.sendAlert(
          room,
          "mq2",
          { ...saved, _thresholds: thresholds },
          current.mq2,
        );
      }
    }

    // ───────────────────────────────────────────────────────
    // MQ4
    // ───────────────────────────────────────────────────────

    if (current.mq4 !== prev.mq4) {
      if (current.mq4 !== "safe") {
        await notificationService.sendAlert(
          room,
          "mq4",
          { ...saved, _thresholds: thresholds },
          current.mq4,
        );
      }
    }

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

    // ───────────────────────────────────────────────────────
    // FLAME
    // ───────────────────────────────────────────────────────

    if (current.flame === "danger" && prev.flame !== "danger") {
      await notificationService.sendAlert(
        room,
        "flame",
        { ...saved, _thresholds: thresholds },
        "danger",
      );
    }

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

    prevState[room] = current;

    res.status(200).json({
      ok: true,
      room,
      status: saved.overallStatus,
    });
  } catch (err) {
    next(err);
  }
}


module.exports = { receiveData };
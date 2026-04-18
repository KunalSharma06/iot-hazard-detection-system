// ─── Sensor Controller ────────────────────────────────────────
// Handles POST /api/sensor/data (called by ESP32)

const roomStore = require("../models/roomstore");
const alertTracker = require("../models/alertTracker");
const notificationService = require("../services/notificationService");
const config = require("../config/notificationConfig");
const thresholds = require("../config/threshold");

// POST /api/sensor/data
async function receiveData(req, res, next) {
  try {
    // Save sensor data (UI/dashboard unchanged)
    const saved = roomStore.upsertRoom(req.body);

    console.log(
      `[DATA] Room ${saved.room} | ` +
        `Temp:${saved.temp}°C  Hum:${saved.humidity}%  ` +
        `MQ2:${saved.mq2}  MQ4:${saved.mq4}  ` +
        `Flame:${saved.flame}  Status:${saved.overallStatus.toUpperCase()}`,
    );

    // ─── Notification Logic ─────────────────────────────
    const currentAlerts = {
      flame: saved.alerts.fire,
      mq2: saved.alerts.mq2,
      mq4: saved.alerts.mq4,
      temp: saved.alerts.temp,
    };

    // Send warning / danger alerts
    for (const key in currentAlerts) {
      if (!currentAlerts[key]) continue;
      if (!config.triggers[key]) continue;
      if (alertTracker.isOnCooldown(saved.room, key)) continue;

      const level = _resolveLevel(key, saved);
      const dataWithThresholds = {
        ...saved,
        _thresholds: thresholds,
      };

      await notificationService.sendAlert(
        saved.room,
        key,
        dataWithThresholds,
        level,
      );

      alertTracker.setCooldown(saved.room, key);
    }

    // Send all clear when all alerts become safe
    const hasAnyAlert =
      currentAlerts.flame ||
      currentAlerts.mq2 ||
      currentAlerts.mq4 ||
      currentAlerts.temp;

    if (!hasAnyAlert && config.triggers.allClear) {
      await notificationService.sendAllClear(saved.room);
    }

    // Same frontend response
    res.status(200).json({
      ok: true,
      status: saved.overallStatus,
    });
  } catch (err) {
    next(err);
  }
}

// Decide warning or danger
function _resolveLevel(key, saved) {
  const l = saved.levels || {};

  if (key === "flame") return "danger";

  if (key === "mq2") {
    return l.mq2 === "danger" ? "danger" : "warning";
  }

  if (key === "mq4") {
    return l.mq4 === "danger" ? "danger" : "warning";
  }

  if (key === "temp") {
    return l.temp === "danger" ? "danger" : "warning";
  }

  return "warning";
}

module.exports = { receiveData };

// // ─── Sensor Controller ────────────────────────────────────────
// // Handles POST /api/sensor/data  (called by ESP32)

// const roomStore = require("../models/roomstore.js");

// // POST /api/sensor/data
// function receiveData(req, res, next) {
//   try {
//     const saved = roomStore.upsertRoom(req.body);

//     console.log(
//       `[DATA] Room ${saved.room} | ` +
//         `Temp:${saved.temp}°C  Hum:${saved.humidity}%  ` +
//         `MQ2:${saved.mq2}  MQ4:${saved.mq4}  ` +
//         `Flame:${saved.flame}  Status:${saved.overallStatus.toUpperCase()}`,
//     );

//     res.status(200).json({ ok: true, status: saved.overallStatus });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { receiveData };



// ─── Sensor Controller ────────────────────────────────────────
// Handles POST /api/sensor/data  (called by ESP32)


const roomStore           = require('../models/roomstore');        // ← UI data (unchanged)
const alertTracker        = require('../models/alertTracker');     // ← NEW
const notificationService = require('../services/notificationService'); // ← NEW
const config              = require('../config/notificationConfig');    // ← NEW
const thresholds          = require('../config/threshold');             // ← NEW

// POST /api/sensor/data
async function receiveData(req, res, next) {
  try {

    // ════ ORIGINAL — saves data, powers your dashboard ════
    const saved = roomStore.upsertRoom(req.body);

    console.log(
      `[DATA] Room ${saved.room} | ` +
      `Temp:${saved.temp}°C  Hum:${saved.humidity}%  ` +
      `MQ2:${saved.mq2}  MQ4:${saved.mq4}  ` +
      `Flame:${saved.flame}  Status:${saved.overallStatus.toUpperCase()}`
    );
    // ════ END ORIGINAL ════

    
    // ════ NEW — notification logic only, does NOT touch UI ════
    const currentAlerts = {
      flame: saved.alerts.fire,
      mq2:   saved.alerts.mq2,
      mq4:   saved.alerts.mq4,
      temp:  saved.alerts.temp,
    };

    const newAlerts = alertTracker.getNewAlerts(saved.room, currentAlerts);

    for (const key of newAlerts) {
      if (!config.triggers[key]) continue;
      if (alertTracker.isOnCooldown(saved.room, key)) continue;

      const level              = _resolveLevel(key, saved);
      const dataWithThresholds = { ...saved, _thresholds: thresholds };

      await notificationService.sendAlert(saved.room, key, dataWithThresholds, level);
      alertTracker.setCooldown(saved.room, key);
    }

    if (config.triggers.allClear && alertTracker.justRecovered(saved.room, currentAlerts)) {
      await notificationService.sendAllClear(saved.room);
    }
    // ════ END NEW ════

    // ════ ORIGINAL — same response your frontend reads ════
    res.status(200).json({ ok: true, status: saved.overallStatus });
    // ════ END ORIGINAL ════

  } catch (err) {
    next(err);
  }
}

// Decides if alert is warning or danger level
function _resolveLevel(key, saved) {
  const l = saved.levels || {};
  if (key === 'flame') return 'danger';
  if (key === 'mq2')   return l.mq2  || 'warning';
  if (key === 'mq4')   return l.mq4  || 'warning';
  if (key === 'temp')  return l.temp || 'warning';
  return 'warning';
}

module.exports = { receiveData };

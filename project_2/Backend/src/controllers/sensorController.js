// ─── Sensor Controller ────────────────────────────────────────
// Handles POST /api/sensor/data  (called by ESP32)

const roomStore = require("../models/roomstore.js");

// POST /api/sensor/data
function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);

    console.log(
      `[DATA] Room ${saved.room} | ` +
        `Temp:${saved.temp}°C  Hum:${saved.humidity}%  ` +
        `MQ2:${saved.mq2}  MQ4:${saved.mq4}  ` +
        `Flame:${saved.flame}  Status:${saved.overallStatus.toUpperCase()}`,
    );

    res.status(200).json({ ok: true, status: saved.overallStatus });
  } catch (err) {
    next(err);
  }
}

module.exports = { receiveData };

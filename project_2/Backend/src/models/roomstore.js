// ─── In-memory Room Data Store ────────────────────────────────
// Stores the latest sensor reading per room.
// To add a database later, just replace get/set methods here.

const thresholds = require("../config/threshold");

// Internal store: { roomId: { ...sensorData, lastSeen: timestamp } }
const store = {};

// ─── Compute level for a sensor value ────────────────────────
function getLevel(value, warnAt, dangerAt) {
  if (value >= dangerAt) return "danger";
  if (value >= warnAt) return "warning";
  return "safe";
}

// ─── Compute alert flags and levels from raw data ────────────
function processData(raw) {
  const t = thresholds;

  const tempLevel = getLevel(
    raw.temp,
    t.temperature.warn,
    t.temperature.danger,
  );
  const mq2Level = getLevel(raw.mq2, t.mq2.warn, t.mq2.danger);
  const mq4Level = getLevel(raw.mq4, t.mq4.warn, t.mq4.danger);

  const humLevel =
    raw.humidity < t.humidity.low_warn || raw.humidity > t.humidity.high_warn
      ? "warning"
      : "safe";

  const flameLevel = raw.flame ? "danger" : "safe";

  // Overall room status = worst of all sensors
  const levels = [tempLevel, mq2Level, mq4Level, humLevel, flameLevel];
  const overallStatus = levels.includes("danger")
    ? "danger"
    : levels.includes("warning")
      ? "warning"
      : "safe";

  return {
    room: raw.room,
    temp: raw.temp,
    humidity: raw.humidity,
    mq2: raw.mq2,
    mq4: raw.mq4,
    flame: raw.flame,
    airQuality: raw.airQuality || "Clean",
    levels: {
      temp: tempLevel,
      humidity: humLevel,
      mq2: mq2Level,
      mq4: mq4Level,
      flame: flameLevel,
    },
    alerts: {
      fire: raw.flame,
      mq2: mq2Level !== "safe",
      mq4: mq4Level !== "safe",
      temp: tempLevel !== "safe",
    },
    overallStatus,
    lastSeen: Date.now(),
  };
}

// ─── Public API ───────────────────────────────────────────────

// Save latest data for a room
function upsertRoom(rawData) {
  const processed = processData(rawData);
  store[rawData.room] = processed;
  return processed;
}

// Get a single room by ID
function getRoom(roomId) {
  const r = store[roomId];
  if (!r) return null;

  const online =
    Date.now() - r.lastSeen < thresholds.offlineAfterSeconds * 1000;
  return { ...r, online };
}

// Get all rooms (IDs 1–3 by default)
function getAllRooms(totalRooms = 3) {
  const result = [];
  for (let i = 1; i <= totalRooms; i++) {
    const r = store[i];
    if (!r) {
      result.push({ room: i, online: false });
    } else {
      const online =
        Date.now() - r.lastSeen < thresholds.offlineAfterSeconds * 1000;
      result.push({ ...r, online });
    }
  }
  return result;
}

module.exports = { upsertRoom, getRoom, getAllRooms };

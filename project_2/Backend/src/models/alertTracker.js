const config = require("../config/notificationConfig");

// { roomId: { flame, mq2, mq4, temp, offline } }
const activeAlerts = {};

// { "roomId_key": timestamp }
const cooldowns = {};

function createDefaultState() {
  return {
    flame: false,
    mq2: false,
    mq4: false,
    temp: false,
    offline: false,
  };
}

// ─────────────────────────────────────────────
// NEW ALERTS
// ─────────────────────────────────────────────

function getNewAlerts(roomId, current) {
  if (!activeAlerts[roomId]) {
    activeAlerts[roomId] = createDefaultState();
  }

  const prev = activeAlerts[roomId];
  const newOnes = [];

  for (const key of Object.keys(current)) {
    // false -> true
    if (current[key] && !prev[key]) {
      newOnes.push(key);
    }
  }

  // update latest state
  activeAlerts[roomId] = {
    ...prev,
    ...current,
  };

  return newOnes;
}

// ─────────────────────────────────────────────
// RECOVERY
// returns true only once when all sensor alerts clear
// ─────────────────────────────────────────────

function justRecovered(roomId, current) {
  if (!activeAlerts[roomId]) {
    activeAlerts[roomId] = createDefaultState();
  }

  const prev = activeAlerts[roomId];

  // ONLY sensor alerts
  const sensorKeys = ["flame", "mq2", "mq4", "temp"];

  const wasAny = sensorKeys.some((k) => prev[k]);

  const nowNone = sensorKeys.every((k) => !current[k]);

  // update state
  activeAlerts[roomId] = {
    ...prev,
    ...current,
  };

  return wasAny && nowNone;
}

// ─────────────────────────────────────────────
// OFFLINE TRACKING
// ─────────────────────────────────────────────

function setOffline(roomId, isOffline) {
  if (!activeAlerts[roomId]) {
    activeAlerts[roomId] = createDefaultState();
  }

  const wasOffline = activeAlerts[roomId].offline;

  activeAlerts[roomId].offline = isOffline;

  // true only ONLINE -> OFFLINE
  return isOffline && !wasOffline;
}

// ─────────────────────────────────────────────
// COOLDOWN
// ─────────────────────────────────────────────

function isOnCooldown(roomId, key) {
  const id = `${roomId}_${key}`;

  const last = cooldowns[id];

  if (!last) return false;

  return Date.now() - last < config.cooldownSeconds * 1000;
}

function setCooldown(roomId, key) {
  cooldowns[`${roomId}_${key}`] = Date.now();
}

// ─────────────────────────────────────────────
// GET STATE
// ─────────────────────────────────────────────

function getState(roomId) {
  return activeAlerts[roomId] || createDefaultState();
}

module.exports = {
  getNewAlerts,
  justRecovered,
  setOffline,
  isOnCooldown,
  setCooldown,
  getState,
};

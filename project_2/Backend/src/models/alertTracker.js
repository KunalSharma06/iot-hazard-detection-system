// ─── Alert Tracker ────────────────────────────────────────────
// Tracks what was previously alerted per room.
// Logic:
//   - Only sends notification when alert is NEW (was false, now true)
//   - Sends "all clear" only when ALL alerts just cleared
//   - Cooldown prevents same alert spamming every 2 seconds

const config = require("../config/notificationConfig");

// { roomId: { flame, mq2, mq4, temp, offline } }
const activeAlerts = {};

// { "roomId_key": timestamp }
const cooldowns = {};

// ── Returns list of keys that are NEWLY true ──────────────────
function getNewAlerts(roomId, current) {
  if (!activeAlerts[roomId]) {
    // First time seeing this room — initialise all false
    activeAlerts[roomId] = {
      flame: false,
      mq2: false,
      mq4: false,
      temp: false,
      offline: false,
    };
  }

  const prev = activeAlerts[roomId];
  const newOnes = [];

  for (const key of Object.keys(current)) {
    // Alert just flipped from false → true
    if (current[key] === true && prev[key] === false) {
      newOnes.push(key);
    }
  }

  // Update stored state with latest values
  activeAlerts[roomId] = { ...prev, ...current };
  return newOnes;
}

// ── Returns true only the first moment ALL alerts cleared ─────
function justRecovered(roomId, current) {
  if (!activeAlerts[roomId]) return false;

  const wasAny = Object.values(activeAlerts[roomId]).some(Boolean);
  const nowNone = Object.values(current).every((v) => !v);

  // Update state even if not a recovery
  activeAlerts[roomId] = { ...activeAlerts[roomId], ...current };

  return wasAny && nowNone;
}

// ── Offline tracking — returns true if room JUST went offline ─
function setOffline(roomId, isOffline) {
  if (!activeAlerts[roomId]) {
    activeAlerts[roomId] = {
      flame: false,
      mq2: false,
      mq4: false,
      temp: false,
      offline: false,
    };
  }
  const wasOffline = activeAlerts[roomId].offline;
  activeAlerts[roomId].offline = isOffline;

  // Returns true only on the transition: online → offline
  return isOffline && !wasOffline;
}

// ── Cooldown helpers ──────────────────────────────────────────
function isOnCooldown(roomId, key) {
  const id = `${roomId}_${key}`;
  const last = cooldowns[id];
  if (!last) return false;
  return Date.now() - last < config.cooldownSeconds * 1000;
}

function setCooldown(roomId, key) {
  cooldowns[`${roomId}_${key}`] = Date.now();
}

// ── Get current alert state for a room (used by /status cmd) ─
function getState(roomId) {
  return activeAlerts[roomId] || null;
}

module.exports = {
  getNewAlerts,
  justRecovered,
  setOffline,
  isOnCooldown,
  setCooldown,
  getState,
};

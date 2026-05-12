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
const offlineAlertSent = {}; // Track if alert was sent at 20s
const roomStatus = {}; // Track room status changes

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);
    const room = saved.room;

    // ✅ UPDATE TIMESTAMP WHEN DATA RECEIVED
    lastUpdate[room] = Date.now();

    if (offlineAlerted[room]) {
      // Room came back online - send recovery alert
      offlineAlerted[room] = false;
      offlineAlertSent[room] = false;
      roomStatus[room] = "online";
      // console.log(`✅ Room ${room} BACK ONLINE!`);
    }

    // console.log(
    //   `[DATA] Room ${room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame}`,
    // );

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
        console.log(`⚠️ Room ${room} MQ2 Alert: ${current.mq2}`);
        await notificationService.sendAlert(
          room,
          "mq2",
          { ...saved, _thresholds: thresholds },
          current.mq2,
        );

        // SEND INTERACTIVE EMERGENCY ALERT
        if (current.mq2 === "danger") {
          // console.log(`🚨 Room ${room} MQ2 DANGER - Sending to helpers!`);
          await emergencyService.startEmergency(room, saved);
        }
      }
    }

    // ── MQ4 — send on ANY level change ───────────────────
    if (current.mq4 !== prev.mq4) {
      if (current.mq4 !== "safe") {
        // console.log(`⚠️ Room ${room} MQ4 Alert: ${current.mq4}`);
        await notificationService.sendAlert(
          room,
          "mq4",
          { ...saved, _thresholds: thresholds },
          current.mq4,
        );

        // SEND INTERACTIVE EMERGENCY ALERT
        if (current.mq4 === "danger") {
          // console.log(`🚨 Room ${room} MQ4 DANGER - Sending to helpers!`);
          await emergencyService.startEmergency(room, saved);
        }
      }
    }

    // ── TEMP — send on ANY level change ──────────────────
    if (current.temp !== prev.temp) {
      if (current.temp !== "safe") {
        // console.log(`⚠️ Room ${room} Temperature Alert: ${current.temp}`);
        await notificationService.sendAlert(
          room,
          "temp",
          { ...saved, _thresholds: thresholds },
          current.temp,
        );

        // SEND INTERACTIVE EMERGENCY ALERT FOR DANGEROUS TEMP
        if (current.temp === "danger") {
          // console.log(`🚨 Room ${room} TEMP DANGER - Sending to helpers!`);
          await emergencyService.startEmergency(room, saved);
        }
      }
    }

    // ── FLAME — send when detected ───────────────────────
    if (current.flame === "danger" && prev.flame !== "danger") {
      // console.log(`🚨🔥 Room ${room} FLAME DETECTED - CRITICAL!`);
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
      // console.log(`✅ Room ${room} ALL CLEAR - Sensors back to normal!`);
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
// PRECISE OFFLINE CHECK - EXACTLY at offlineAfterSeconds
// Checks every 1 second for precise timing
// ════════════════════════════════════════════════════════════

setInterval(() => {
  const now = Date.now();

  // Get offline timeout from config (in milliseconds)
  const OFFLINE_TIMEOUT = (thresholds.offlineAfterSeconds || 20) * 1000;

  for (let roomId = 1; roomId <= 3; roomId++) {
    const lastTime = lastUpdate[roomId];

    if (lastTime) {
      const timeSinceLastUpdate = now - lastTime;

      // ─── EXACT OFFLINE DETECTION AT 20 SECONDS ─────────
      if (timeSinceLastUpdate >= OFFLINE_TIMEOUT) {
        // Send alert ONLY ONCE, at exactly 20 seconds
        if (!offlineAlertSent[roomId]) {
          // const seconds = Math.round(timeSinceLastUpdate / 1000);
          // console.log(
          //   `🚨 CRITICAL: Room ${roomId} OFFLINE! (Exactly ${seconds}s - sending alert NOW!)`,
          // );

          // ← SEND ALERT TO ALL SUBSCRIBERS
          notificationService.sendOfflineAlert(roomId);

          offlineAlertSent[roomId] = true; // Mark as sent, never send again
          offlineAlerted[roomId] = true;
          roomStatus[roomId] = "offline";
        }
      }

      // ─── ROOM IS BACK ONLINE ──────────────────────────
      else {
        // If it was offline and now back online
        if (offlineAlerted[roomId]) {
          // console.log(`✅ Room ${roomId} RECOVERED - Back online!`);
          notificationService.sendAllClear(roomId);
          offlineAlerted[roomId] = false;
          offlineAlertSent[roomId] = false;
          roomStatus[roomId] = "online";
        }
      }
    }
  }

  // ─── PRINT STATUS SUMMARY ──────────────────────────────
  const statusSummary = [];
  for (let i = 1; i <= 3; i++) {
    const status = roomStatus[i] || "unknown";
    const emoji = status === "online" ? "🟢" : "🔴";
    const lastTime = lastUpdate[i];
    let timeInfo = "";

    if (lastTime) {
      const secondsSinceUpdate = Math.round((now - lastTime) / 1000);
      const offlineTimeout = thresholds.offlineAfterSeconds || 20;

      if (secondsSinceUpdate >= offlineTimeout) {
        timeInfo = ` (${secondsSinceUpdate}s - OFFLINE!)`;
      } else {
        timeInfo = ` (${secondsSinceUpdate}/${offlineTimeout}s)`;
      }
    }

    statusSummary.push(`${emoji} Room ${i}${timeInfo}`);
  }
  // console.log(`[STATUS] ${statusSummary.join(" | ")}`);
}, 1000); // Check EVERY 1 SECOND for precise timing at 20s

module.exports = { receiveData };

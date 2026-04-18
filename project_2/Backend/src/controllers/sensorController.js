const roomStore = require("../models/roomstore");
const notificationService = require("../services/notificationService");
const config = require("../config/notificationConfig");
const thresholds = require("../config/threshold");

const cooldown = {}; // simple memory cooldown

async function receiveData(req, res, next) {
  try {
    const saved = roomStore.upsertRoom(req.body);

    console.log(
      `[DATA] Room ${saved.room} | Temp:${saved.temp}°C Hum:${saved.humidity}% MQ2:${saved.mq2} MQ4:${saved.mq4} Flame:${saved.flame} Status:${saved.overallStatus}`,
    );

    const room = saved.room;

    // MQ2
    if (saved.mq2 >= thresholds.mq2.danger) {
      await send(room, "mq2", saved, "danger");
    } else if (saved.mq2 >= thresholds.mq2.warn) {
      await send(room, "mq2", saved, "warning");
    }

    // MQ4
    if (saved.mq4 >= thresholds.mq4.danger) {
      await send(room, "mq4", saved, "danger");
    } else if (saved.mq4 >= thresholds.mq4.warn) {
      await send(room, "mq4", saved, "warning");
    }

    // TEMP
    if (saved.temp >= thresholds.temperature.danger) {
      await send(room, "temp", saved, "danger");
    } else if (saved.temp >= thresholds.temperature.warn) {
      await send(room, "temp", saved, "warning");
    }

    // FLAME
    if (saved.flame) {
      await send(room, "flame", saved, "danger");
    }

    // ALL CLEAR
    if (
      saved.mq2 < thresholds.mq2.warn &&
      saved.mq4 < thresholds.mq4.warn &&
      saved.temp < thresholds.temperature.warn &&
      !saved.flame
    ) {
      await notificationService.sendAllClear(room);
    }

    res.status(200).json({
      ok: true,
      status: saved.overallStatus,
    });
  } catch (err) {
    next(err);
  }
}

async function send(room, key, saved, level) {
  const id = room + "_" + key;
  const now = Date.now();

  if (cooldown[id] && now - cooldown[id] < 60000) return;

  await notificationService.sendAlert(
    room,
    key,
    { ...saved, _thresholds: thresholds },
    level,
  );

  cooldown[id] = now;
}

module.exports = { receiveData };

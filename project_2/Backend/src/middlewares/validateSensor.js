// ─── Sensor Data Validator Middleware ────────────────────────
// Runs before sensorController.receiveData
// Returns 400 with a clear message if required fields are missing

function validateSensorData(req, res, next) {
  const d = req.body;
  const required = ["room", "temp", "humidity", "mq2", "mq4"];

  for (const field of required) {
    if (d[field] === undefined || d[field] === null) {
      return res.status(400).json({
        ok: false,
        error: `Missing required field: "${field}"`,
      });
    }
  }

  // room must be a positive integer
  const roomId = parseInt(d.room);
  if (isNaN(roomId) || roomId < 1) {
    return res.status(400).json({
      ok: false,
      error: 'Field "room" must be a positive integer (e.g. 1, 2, 3)',
    });
  }

  // flame must be boolean (ESP32 sends true/false)
  if (typeof d.flame !== "boolean") {
    return res.status(400).json({
      ok: false,
      error: 'Field "flame" must be a boolean (true or false)',
    });
  }

  next();
}

module.exports = validateSensorData;

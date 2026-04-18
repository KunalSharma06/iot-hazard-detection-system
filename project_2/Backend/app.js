const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const roomRoutes = require("./src/routes/roomRoutes");
const sensorRoutes = require("./src/routes/sensorRoutes");
const errorHandler = require("./src/middlewares/errorHandler");
const { startPolling } = require("./src/services/telegramBotService"); // ← ADD THIS

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── API Routes ───────────────────────────────────────────────
app.use("/api/rooms", roomRoutes);
app.use("/api/sensor", sensorRoutes);

// ─── Serve index.html for all non-API routes ─────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ─── Global error handler (must be last) ─────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ Hazard Monitor Server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://<YOUR_IP>:${PORT}`);
  console.log(
    `\n   ESP32 POST endpoint: http://<YOUR_IP>:${PORT}/api/sensor/data\n`,
  );

  startPolling(); // ← ADD THIS
});

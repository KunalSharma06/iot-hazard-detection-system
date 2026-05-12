// ════════════════════════════════════════════════════════════
// UPDATED emergencyService.js - For your project
// ════════════════════════════════════════════════════════════

const { sendEmergencyAlert } = require("./helperBot");

async function startEmergency(roomId, sensorData = {}) {
  try {
    const emergencyId = await sendEmergencyAlert(roomId, {
      temperature: sensorData.temp || sensorData.temperature || "N/A",
      humidity: sensorData.humidity || "N/A",
      mq2: sensorData.mq2 || "N/A",
      mq4: sensorData.mq4 || "N/A",
      flame: sensorData.flame || false,
      message: generateAlertMessage(sensorData),
    });

    if (emergencyId) {
      // console.log("✅ Emergency started with ID:", emergencyId);
      return emergencyId;
    }
  } catch (err) {
    // console.error("❌ Error starting emergency:", err);
  }
}

function generateAlertMessage(sensorData) {
  if (sensorData.mq2 > 350) {
    return "🔴 CRITICAL: MQ2 Smoke/Gas Detected - Evacuate Area";
  }
  if (sensorData.mq4 > 1000) {
    return "🔴 CRITICAL: MQ4 Natural Gas Leak Detected";
  }
  if (sensorData.flame) {
    return "🔴 CRITICAL: FIRE DETECTED - EVACUATE IMMEDIATELY";
  }
  if (sensorData.temperature > 35) {
    return "🔴 CRITICAL: Temperature Exceeds Safe Level";
  }
  return "⚠️ ALERT: Threshold Exceeded";
}

module.exports = {
  startEmergency,
};

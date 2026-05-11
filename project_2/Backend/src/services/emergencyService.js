const { sendEmergencyAlert } = require("./helperBot");

async function startEmergency(room, sensorData = {}) {
  try {
    const emergencyId = await sendEmergencyAlert(room, {
      temperature: sensorData.temperature || "N/A",
      humidity: sensorData.humidity || "N/A",
      message: sensorData.message || "Threshold exceeded",
    });

    if (emergencyId) {
      console.log("✅ Emergency started with ID:", emergencyId);
      return emergencyId;
    }
  } catch (err) {
    console.error("❌ Error starting emergency:", err);
  }
}

module.exports = {
  startEmergency,
};

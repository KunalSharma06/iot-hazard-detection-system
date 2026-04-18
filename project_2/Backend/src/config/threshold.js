// // ─── Sensor Thresholds ────────────────────────────────────────
// // Adjust these to match your environment (industrial, home, lab)

// module.exports = {
//   temperature: {
//     warn: 40, // °C — show yellow warning
//     danger: 45, // °C — show red danger
//   },
//   humidity: {
//     low_warn: 20, // % — too dry
//     high_warn: 85, // % — too humid
//   },
//   mq2: {
//     warn: 600, // ADC value — LPG / Smoke
//     danger: 1200,
//   },
//   mq4: {
//     warn: 700, // ADC value — Methane / CNG
//     danger: 1400,
//   },
//   // How many seconds before a room is marked "offline"
//   offlineAfterSeconds: 10,
// };


// ─── Sensor Thresholds ────────────────────────────────────────
// Matched to ESP32 firmware (12-bit ADC differential readings)
// Industry references: OSHA, EN54, ASHRAE

module.exports = {
  temperature: {
    warn: 40,    // °C — ASHRAE upper comfort limit
    danger: 50,  // °C — EN54 fire detection standard
  },

  humidity: {
    low_warn: 20,   // % — too dry (static risk)
    high_warn: 85,  // % — too humid (condensation risk)
  },

  mq2: {
    warn: 200,   // ADC differential — ~300 ppm LPG
    danger: 400, // ADC differential — ~1000 ppm LPG / 50 ppm CO (OSHA limit)
  },

  mq4: {
    warn: 250,   // ADC differential — ~1000 ppm methane
    danger: 500, // ADC differential — ~5000 ppm methane (LEL boundary)
  },

  // Seconds before a room is marked "offline"
  offlineAfterSeconds: 45,
};
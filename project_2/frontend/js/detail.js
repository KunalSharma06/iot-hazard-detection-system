/* ════════════════════════════════════════════════
   DETAIL.JS  —  renders the room detail gauge page
   ════════════════════════════════════════════════ */

const DetailPage = (() => {
  // Normalise a value to 0-1 for the gauge ring
  const PCT = {
    temp: (v) => Math.min(v / 60, 1),
    humidity: (v) => Math.min(v / 100, 1),
    mq2: (v) => Math.min(v / 2000, 1),
    mq4: (v) => Math.min(v / 2000, 1),
  };

  let _built = false;

  // ── First render: build all gauge cards ─────── //
  function build(room) {
    const grid = document.getElementById("sensor-grid");
    grid.innerHTML = "";
    _built = false;

    const l = room.levels || {};

    // Temperature
    grid.appendChild(
      Gauge.buildCard({
        id: "temp",
        label: "Temperature",
        value: room.temp?.toFixed(1),
        unit: "°C",
        pct: PCT.temp(room.temp || 0),
        level: l.temp || "safe",
      }),
    );

    // Humidity
    grid.appendChild(
      Gauge.buildCard({
        id: "hum",
        label: "Humidity",
        value: room.humidity?.toFixed(0),
        unit: "%",
        pct: PCT.humidity(room.humidity || 0),
        level: l.humidity || "safe",
      }),
    );

    // MQ2
    grid.appendChild(
      Gauge.buildCard({
        id: "mq2",
        label: "LPG / Smoke  (MQ2)",
        value: room.mq2,
        unit: "ADC",
        pct: PCT.mq2(room.mq2 || 0),
        level: l.mq2 || "safe",
      }),
    );

    // MQ4
    grid.appendChild(
      Gauge.buildCard({
        id: "mq4",
        label: "Methane / CNG  (MQ4)",
        value: room.mq4,
        unit: "ADC",
        pct: PCT.mq4(room.mq4 || 0),
        level: l.mq4 || "safe",
      }),
    );

    // Flame
    grid.appendChild(Gauge.buildFlameCard(room.flame));

    // Air quality
    grid.appendChild(
      Gauge.buildAirCard(room.airQuality || "Clean", l.mq2 || "safe"),
    );

    _built = true;

    _updateBanner(room);
    document.getElementById("detail-title").textContent = `Room ${room.room}`;
    document.getElementById("detail-sub").textContent = room.online
      ? "Live · updates every 2 seconds"
      : "Offline — last known data shown";
  }

  // ── Subsequent updates: patch values in-place ─ //
  function update(room) {
    if (!_built) {
      build(room);
      return;
    }

    const l = room.levels || {};

    Gauge.updateCard(
      "temp",
      room.temp?.toFixed(1),
      "°C",
      PCT.temp(room.temp || 0),
      l.temp || "safe",
    );
    Gauge.updateCard(
      "hum",
      room.humidity?.toFixed(0),
      "%",
      PCT.humidity(room.humidity || 0),
      l.humidity || "safe",
    );
    Gauge.updateCard(
      "mq2",
      room.mq2,
      "ADC",
      PCT.mq2(room.mq2 || 0),
      l.mq2 || "safe",
    );
    Gauge.updateCard(
      "mq4",
      room.mq4,
      "ADC",
      PCT.mq4(room.mq4 || 0),
      l.mq4 || "safe",
    );
    Gauge.updateFlameCard(room.flame);
    Gauge.updateAirCard(room.airQuality || "Clean", l.mq2 || "safe");

    _updateBanner(room);
  }

  function _updateBanner(room) {
    const banner = document.getElementById("status-banner");
    if (room.overallStatus === "danger") {
      banner.className = "status-banner danger";
      const triggers = [];
      if (room.alerts?.fire) triggers.push("Flame detected");
      if (room.alerts?.mq2) triggers.push("LPG/Smoke high");
      if (room.alerts?.mq4) triggers.push("Methane high");
      if (room.alerts?.temp) triggers.push("Temperature high");
      banner.innerHTML = `<span class="banner-icon">🚨</span> DANGER — ${triggers.join(" · ")}`;
      banner.classList.remove("hidden");
    } else if (room.overallStatus === "warning") {
      banner.className = "status-banner warning";
      banner.innerHTML = `<span class="banner-icon">⚠️</span> WARNING — Check sensor readings`;
      banner.classList.remove("hidden");
    } else {
      banner.className = "status-banner safe";
      banner.innerHTML = `<span class="banner-icon">✅</span> All sensors normal`;
      banner.classList.remove("hidden");
    }
  }

  function reset() {
    _built = false;
  }

  return { build, update, reset };
})();

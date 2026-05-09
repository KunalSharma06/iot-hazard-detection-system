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

    // ✨ ADDED: Handle Room 3 (combined view of all 3 rooms) ✨
    if (room.room === 3) {
      // Get the data that was passed - it should contain all 3 rooms
      const rooms = room.allRooms || [room];

      // Display each room's data in the combined view
      rooms.forEach((r) => {
        if (!r) return;

        const roomLevel = r.levels || {};
        const roomDiv = document.createElement("div");
        roomDiv.style.cssText =
          "margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);";
        roomDiv.innerHTML = `<h3 style="margin: 0 0 12px 0; font-size: 18px; color: var(--text);">Room ${r.room}</h3>`;

        // Create a mini grid for each room
        const miniGrid = document.createElement("div");
        miniGrid.className = "room-mini-grid";

        // Temperature
        miniGrid.appendChild(
          Gauge.buildCard({
            id: `temp-room${r.room}`,
            label: "Temperature",
            value: r.temp?.toFixed(1),
            unit: "°C",
            pct: PCT.temp(r.temp || 0),
            level: roomLevel.temp || "safe",
          }),
        );

        // Humidity
        miniGrid.appendChild(
          Gauge.buildCard({
            id: `hum-room${r.room}`,
            label: "Humidity",
            value: r.humidity?.toFixed(0),
            unit: "%",
            pct: PCT.humidity(r.humidity || 0),
            level: roomLevel.humidity || "safe",
          }),
        );

        // MQ2
        miniGrid.appendChild(
          Gauge.buildCard({
            id: `mq2-room${r.room}`,
            label: "LPG / Smoke  (MQ2)",
            value: r.mq2,
            unit: "ADC",
            pct: PCT.mq2(r.mq2 || 0),
            level: roomLevel.mq2 || "safe",
          }),
        );

        // MQ4
        miniGrid.appendChild(
          Gauge.buildCard({
            id: `mq4-room${r.room}`,
            label: "Methane / CNG  (MQ4)",
            value: r.mq4,
            unit: "ADC",
            pct: PCT.mq4(r.mq4 || 0),
            level: roomLevel.mq4 || "safe",
          }),
        );

        // Flame
        miniGrid.appendChild(Gauge.buildFlameCard(r.flame));

        // Air quality
        miniGrid.appendChild(
          Gauge.buildAirCard(r.airQuality || "Clean", roomLevel.mq2 || "safe"),
        );

        roomDiv.appendChild(miniGrid);
        grid.appendChild(roomDiv);
      });

      _built = true;
      _updateBannerRoom3(rooms);
      document.getElementById("detail-title").textContent = "All Rooms Monitor";
      document.getElementById("detail-sub").textContent =
        "Live view of all 3 rooms";
      return;
    }
    // ✨ END: Room 3 handling ✨

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

    // ✨ ADDED: Handle Room 3 updates ✨
    if (room.room === 3 && room.allRooms) {
      // For Room 3, rebuild since we have all rooms data
      const rooms = room.allRooms;
      const grid = document.getElementById("sensor-grid");

      rooms.forEach((r, idx) => {
        if (!r) return;
        const roomLevel = r.levels || {};

        // Update each room's gauges
        Gauge.updateCard(
          `temp-room${r.room}`,
          r.temp?.toFixed(1),
          "°C",
          PCT.temp(r.temp || 0),
          roomLevel.temp || "safe",
        );
        Gauge.updateCard(
          `hum-room${r.room}`,
          r.humidity?.toFixed(0),
          "%",
          PCT.humidity(r.humidity || 0),
          roomLevel.humidity || "safe",
        );
        Gauge.updateCard(
          `mq2-room${r.room}`,
          r.mq2,
          "ADC",
          PCT.mq2(r.mq2 || 0),
          roomLevel.mq2 || "safe",
        );
        Gauge.updateCard(
          `mq4-room${r.room}`,
          r.mq4,
          "ADC",
          PCT.mq4(r.mq4 || 0),
          roomLevel.mq4 || "safe",
        );
        Gauge.updateFlameCard(r.flame);
        Gauge.updateAirCard(r.airQuality || "Clean", roomLevel.mq2 || "safe");
      });

      _updateBannerRoom3(rooms);
      return;
    }
    // ✨ END: Room 3 updates ✨

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

  // ✨ ADDED: Banner update for Room 3 (all rooms) ✨
  function _updateBannerRoom3(rooms) {
    const banner = document.getElementById("status-banner");
    const hasAnyDanger = rooms.some((r) => r.overallStatus === "danger");
    const hasAnyWarning = rooms.some((r) => r.overallStatus === "warning");

    if (hasAnyDanger) {
      banner.className = "status-banner danger";
      const dangerRooms = rooms
        .filter((r) => r.overallStatus === "danger")
        .map((r) => `Room ${r.room}`);
      banner.innerHTML = `<span class="banner-icon">🚨</span> DANGER IN ${dangerRooms.join(", ")}`;
      banner.classList.remove("hidden");
    } else if (hasAnyWarning) {
      banner.className = "status-banner warning";
      const warningRooms = rooms
        .filter((r) => r.overallStatus === "warning")
        .map((r) => `Room ${r.room}`);
      banner.innerHTML = `<span class="banner-icon">⚠️</span> WARNING IN ${warningRooms.join(", ")}`;
      banner.classList.remove("hidden");
    } else {
      banner.className = "status-banner safe";
      banner.innerHTML = `<span class="banner-icon">✅</span> All rooms normal`;
      banner.classList.remove("hidden");
    }
  }
  // ✨ END: Room 3 banner function ✨

  function reset() {
    _built = false;
  }

  return { build, update, reset };
})();

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
  let _isRoom3View = false;

  // ── Build gauge cards for a single room ─────── //
  function _buildRoomGauges(room, roomNum, grid) {
    const l = room.levels || {};
    const roomClass = "gauge-room-section";

    // Create room header
    const roomHeader = document.createElement("div");
    roomHeader.className = "room-header";
    roomHeader.style.cssText = `
      grid-column: 1 / -1;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 18px;
      font-weight: bold;
      color: #00ff88;
      border-left: 4px solid #00ff88;
    `;
    roomHeader.textContent = `Room ${roomNum}`;
    grid.appendChild(roomHeader);

    // Temperature
    grid.appendChild(
      Gauge.buildCard({
        id: `temp-room${roomNum}`,
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
        id: `hum-room${roomNum}`,
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
        id: `mq2-room${roomNum}`,
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
        id: `mq4-room${roomNum}`,
        label: "Methane / CNG  (MQ4)",
        value: room.mq4,
        unit: "ADC",
        pct: PCT.mq4(room.mq4 || 0),
        level: l.mq4 || "safe",
      }),
    );

    // Flame
    grid.appendChild(Gauge.buildFlameCard(room.flame, `flame-room${roomNum}`));

    // Air quality
    grid.appendChild(
      Gauge.buildAirCard(
        room.airQuality || "Clean",
        l.mq2 || "safe",
        `air-room${roomNum}`,
      ),
    );
  }

  // ── First render: build all gauge cards ─────── //
  /* ========= frontend/js/detail.js ========= */
  /* REPLACE COMPLETE build(room) FUNCTION */

  function build(room) {
    const grid = document.getElementById("sensor-grid");
    grid.innerHTML = "";
    _built = false;

    // ───────── ROOM 3 MAIN MONITOR ─────────
    /* ========= REPLACE COMPLETE ROOM 3 BLOCK INSIDE build(room) ========= */

    if (room.room === 3) {
      _isRoom3View = true;

      document.getElementById("detail-title").textContent =
        "Room 3 - Main Monitor";

      document.getElementById("detail-sub").textContent =
        "Showing Room 1 & Room 2 Live Data";

      grid.innerHTML = "";

      const room1 = room.roomsData?.room1;
      const room2 = room.roomsData?.room2;

      function showRoom(roomData, roomNum) {
        // ROOM TITLE
        const title = document.createElement("div");

        title.style.gridColumn = "1 / -1";
        title.style.margin = "10px 0 5px";

        title.innerHTML = `
      <h2 style="
        font-size:28px;
        font-weight:700;
        color:white;
      ">
        Room ${roomNum}
      </h2>
    `;

        grid.appendChild(title);

        // NO DATA
        if (!roomData || !roomData.online) {
          const noData = document.createElement("div");

          noData.className = "gauge-card";
          noData.style.gridColumn = "1 / -1";

          noData.innerHTML = `
        <div style="
          height:220px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:24px;
          font-weight:700;
          color:#ff6b6b;
        ">
          No Data Received
        </div>
      `;

          grid.appendChild(noData);
          return;
        }

        const l = roomData.levels || {};

        // TEMPERATURE
        grid.appendChild(
          Gauge.buildCard({
            id: `temp-room${roomNum}`,
            label: "Temperature",
            value: roomData.temp?.toFixed(1),
            unit: "°C",
            pct: PCT.temp(roomData.temp || 0),
            level: l.temp || "safe",
          }),
        );

        // HUMIDITY
        grid.appendChild(
          Gauge.buildCard({
            id: `hum-room${roomNum}`,
            label: "Humidity",
            value: roomData.humidity?.toFixed(0),
            unit: "%",
            pct: PCT.humidity(roomData.humidity || 0),
            level: l.humidity || "safe",
          }),
        );

        // MQ2
        grid.appendChild(
          Gauge.buildCard({
            id: `mq2-room${roomNum}`,
            label: "LPG / Smoke (MQ2)",
            value: roomData.mq2,
            unit: "ADC",
            pct: PCT.mq2(roomData.mq2 || 0),
            level: l.mq2 || "safe",
          }),
        );

        // MQ4
        grid.appendChild(
          Gauge.buildCard({
            id: `mq4-room${roomNum}`,
            label: "Methane / CNG (MQ4)",
            value: roomData.mq4,
            unit: "ADC",
            pct: PCT.mq4(roomData.mq4 || 0),
            level: l.mq4 || "safe",
          }),
        );

        // FLAME
        grid.appendChild(
          Gauge.buildFlameCard(roomData.flame, `flame-room${roomNum}`),
        );

        // AIR QUALITY
        grid.appendChild(
          Gauge.buildAirCard(
            roomData.airQuality || "Clean",
            l.mq2 || "safe",
            `air-room${roomNum}`,
          ),
        );
      }

      // ROOM 1
      showRoom(room1, 1);

      // ROOM 2
      showRoom(room2, 2);

      _updateBannerRoom3([room1, room2].filter(Boolean));

      _built = true;
      return;
    }

    const l = room.levels || {};

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

    grid.appendChild(Gauge.buildFlameCard(room.flame));

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

    if (_isRoom3View && room.roomsData) {
      // Update all rooms
      const allRooms = [room.roomsData.room1, room.roomsData.room2].filter(
        Boolean,
      );
      for (let i = 1; i <= 2; i++) {
        const r = allRooms.find((ar) => ar.room === i);
        if (r) {
          const l = r.levels || {};
          Gauge.updateCard(
            `temp-room${i}`,
            r.temp?.toFixed(1),
            "°C",
            PCT.temp(r.temp || 0),
            l.temp || "safe",
          );
          Gauge.updateCard(
            `hum-room${i}`,
            r.humidity?.toFixed(0),
            "%",
            PCT.humidity(r.humidity || 0),
            l.humidity || "safe",
          );
          Gauge.updateCard(
            `mq2-room${i}`,
            r.mq2,
            "ADC",
            PCT.mq2(r.mq2 || 0),
            l.mq2 || "safe",
          );
          Gauge.updateCard(
            `mq4-room${i}`,
            r.mq4,
            "ADC",
            PCT.mq4(r.mq4 || 0),
            l.mq4 || "safe",
          );
          Gauge.updateFlameCard(r.flame, `flame-room${i}`);
          Gauge.updateAirCard(
            r.airQuality || "Clean",
            l.mq2 || "safe",
            `air-room${i}`,
          );
        }
      }
      _updateBannerRoom3(allRooms);
    } else {
      // Single room update
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

  function _updateBannerRoom3(allRooms) {
    const banner = document.getElementById("status-banner");

    // Check if any room has danger or warning
    const dangerRooms = allRooms.filter((r) => r.overallStatus === "danger");
    const warningRooms = allRooms.filter((r) => r.overallStatus === "warning");

    if (dangerRooms.length > 0) {
      banner.className = "status-banner danger";
      const roomNums = dangerRooms.map((r) => `Room ${r.room}`).join(", ");
      banner.innerHTML = `<span class="banner-icon">🚨</span> DANGER in ${roomNums}`;
      banner.classList.remove("hidden");
    } else if (warningRooms.length > 0) {
      banner.className = "status-banner warning";
      const roomNums = warningRooms.map((r) => `Room ${r.room}`).join(", ");
      banner.innerHTML = `<span class="banner-icon">⚠️</span> WARNING in ${roomNums}`;
      banner.classList.remove("hidden");
    } else {
      banner.className = "status-banner safe";
      banner.innerHTML = `<span class="banner-icon">✅</span> All sensors normal in all rooms`;
      banner.classList.remove("hidden");
    }
  }

  function reset() {
    _built = false;
    _isRoom3View = false;
  }

  return { build, update, reset };
})();

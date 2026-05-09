/* ════════════════════════════════════════════════
   ROOMS.JS  —  renders the 3-room grid page
   ════════════════════════════════════════════════ */

const RoomsPage = (() => {
  function _pillClass(status) {
    if (status === "danger") return "pill-danger";
    if (status === "warning") return "pill-warning";
    if (!status || status === "offline") return "pill-offline";
    return "pill-safe";
  }

  function _pillText(status) {
    if (status === "danger") return "Alert!";
    if (status === "warning") return "Warning";
    if (!status || status === "offline") return "OFF";
    return "Safe";
  }

  function _valueClass(level) {
    if (level === "danger") return "danger";
    if (level === "warning") return "warn";
    return "";
  }

  function _buildCard(room, onClickFn, allRooms) {
    const status = room.online ? room.overallStatus || "safe" : "offline";
    const card = document.createElement("div");
    card.className = `room-card ${status}`;

    // Special handling for Room 3 (Display Unit showing Room 1 & 2 data)
    if (room.room === 3) {
      // Get Room 1 and Room 2 data
      const room1 = allRooms?.find((r) => r.room === 1);
      const room2 = allRooms?.find((r) => r.room === 2);

      // Check if ANY data is received from Room 1 or 2
      const hasData = room1?.online || room2?.online;

      // Room 3 status should be based on the data it's receiving
      let room3CompositeStatus = "offline";
      if (hasData) {
        // Check if either room has danger
        if (
          room1?.overallStatus === "danger" ||
          room2?.overallStatus === "danger"
        ) {
          room3CompositeStatus = "danger";
        } else if (
          room1?.overallStatus === "warning" ||
          room2?.overallStatus === "warning"
        ) {
          room3CompositeStatus = "warning";
        } else {
          room3CompositeStatus = "safe";
        }
      }

      // Helper function to get status class for each room
      const getRoomStatus = (r) => {
        if (!r || !r.online) return "offline";
        return r.overallStatus || "safe";
      };

      const room1Status = getRoomStatus(room1);
      const room2Status = getRoomStatus(room2);

      // Build Room 1 section
      const room1HTML = room1?.online
        ? `
        <div class="room-mini-grid">
          <div class="mini-stat">
            <span class="mini-stat-label">Temperature</span>
            <span class="mini-stat-value ${_valueClass(room1.levels?.temp)}">
              ${room1.temp?.toFixed(1) ?? "--"}°C
            </span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-label">Humidity</span>
            <span class="mini-stat-value ${_valueClass(room1.levels?.humidity)}">
              ${room1.humidity?.toFixed(0) ?? "--"}%
            </span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-label">MQ2 (LPG)</span>
            <span class="mini-stat-value ${_valueClass(room1.levels?.mq2)}">
              ${room1.mq2 ?? "--"}
            </span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-label">MQ4 (CH₄)</span>
            <span class="mini-stat-value ${_valueClass(room1.levels?.mq4)}">
              ${room1.mq4 ?? "--"}
            </span>
          </div>
        </div>
      `
        : `<p class="offline-label">Data not received</p>`;

      // Build Room 2 section
      const room2HTML = room2?.online
        ? `
        <div class="room-mini-grid">
          <div class="mini-stat">
            <span class="mini-stat-label">Temperature</span>
            <span class="mini-stat-value ${_valueClass(room2.levels?.temp)}">
              ${room2.temp?.toFixed(1) ?? "--"}°C
            </span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-label">Humidity</span>
            <span class="mini-stat-value ${_valueClass(room2.levels?.humidity)}">
              ${room2.humidity?.toFixed(0) ?? "--"}%
            </span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-label">MQ2 (LPG)</span>
            <span class="mini-stat-value ${_valueClass(room2.levels?.mq2)}">
              ${room2.mq2 ?? "--"}
            </span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-label">MQ4 (CH₄)</span>
            <span class="mini-stat-value ${_valueClass(room2.levels?.mq4)}">
              ${room2.mq4 ?? "--"}
            </span>
          </div>
        </div>
      `
        : `<p class="offline-label">Data not received</p>`;

      card.innerHTML = `
        <div class="room-bg-number">3</div>
        <div class="room-card-top">
          <span class="room-label">Room 3 - Monitor</span>
          <span class="room-status-pill ${_pillClass(room3CompositeStatus)}">
            ${_pillText(room3CompositeStatus)}
          </span>
        </div>
        
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="room-label" style="font-size: 14px;">Room 1</span>
            <span class="room-status-pill ${_pillClass(room1Status)}" style="font-size: 9px; padding: 3px 8px;">
              ${_pillText(room1Status)}
            </span>
          </div>
          ${room1HTML}
        </div>
        
        <div style="padding-top: 12px; border-top: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="room-label" style="font-size: 14px;">Room 2</span>
            <span class="room-status-pill ${_pillClass(room2Status)}" style="font-size: 9px; padding: 3px 8px;">
              ${_pillText(room2Status)}
            </span>
          </div>
          ${room2HTML}
        </div>
      `;

      // ✨ Room 3 IS NOW CLICKABLE if data is received
      if (hasData) {
        card.addEventListener("click", () => onClickFn(room.room));
        card.style.cursor = "pointer";
      }
      return card;
    }

    // Normal handling for Room 1 and Room 2
    const alertTags = [];
    if (room.online && room.alerts) {
      if (room.alerts.fire) alertTags.push("Flame");
      if (room.alerts.mq2) alertTags.push("LPG / Smoke");
      if (room.alerts.mq4) alertTags.push("Methane");
      if (room.alerts.temp) alertTags.push("High Temp");
    }

    const alertHTML = alertTags.length
      ? `<div class="alert-tags">${alertTags.map((t) => `<span class="alert-tag">⚠ ${t}</span>`).join("")}</div>`
      : "";

    const statsHTML = room.online
      ? `
        <div class="room-stats">
          <div class="stat">
            <span class="stat-label">Temperature</span>
            <span class="stat-value ${_valueClass(room.levels?.temp)}">
              ${room.temp?.toFixed(1) ?? "--"}°C
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Humidity</span>
            <span class="stat-value ${_valueClass(room.levels?.humidity)}">
              ${room.humidity?.toFixed(0) ?? "--"}%
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">MQ2 (LPG)</span>
            <span class="stat-value ${_valueClass(room.levels?.mq2)}">
              ${room.mq2 ?? "--"}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">MQ4 (CH₄)</span>
            <span class="stat-value ${_valueClass(room.levels?.mq4)}">
              ${room.mq4 ?? "--"}
            </span>
          </div>
        </div>
        ${alertHTML}
      `
      : '<p class="offline-msg">Waiting for data...</p>';

    card.innerHTML = `
      <div class="room-bg-number">${room.room}</div>
      <div class="room-card-top">
        <span class="room-label">Room ${room.room}</span>
        <span class="room-status-pill ${_pillClass(status)}">${_pillText(status)}</span>
      </div>
      ${statsHTML}
    `;

    // Make cards clickable
    card.addEventListener("click", () => onClickFn(room.room));
    card.style.cursor = "pointer";

    return card;
  }

  // ── Rendering ────────────────────────────────── //
  function render(rooms, onClickFn) {
    const roomsGrid = document.getElementById("rooms-grid");
    roomsGrid.innerHTML = "";

    // Add room 1, 2, 3 cards
    for (const room of rooms) {
      roomsGrid.appendChild(_buildCard(room, onClickFn, rooms));
    }
  }

  function update(rooms, onClickFn) {
    const roomsGrid = document.getElementById("rooms-grid");
    const cards = roomsGrid.querySelectorAll(".room-card");

    cards.forEach((card, idx) => {
      card.replaceWith(_buildCard(rooms[idx], onClickFn, rooms));
    });
  }

  return { render, update };
})();

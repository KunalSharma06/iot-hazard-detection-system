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

  function _pillText(room) {
    if (!room.online) return "Offline";
    if (room.overallStatus === "danger") return "Alert!";
    if (room.overallStatus === "warning") return "Warning";
    return "Safe";
  }

  function _valueClass(level) {
    if (level === "danger") return "danger";
    if (level === "warning") return "warn";
    return "";
  }

  function _buildCard(room, onClickFn) {
    const status = room.online ? room.overallStatus || "safe" : "offline";
    const card = document.createElement("div");
    card.className = `room-card ${status}`;

    // Alert tags
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
      <div class="room-mini-grid">
        <div class="mini-stat">
          <span class="mini-stat-label">Temperature</span>
          <span class="mini-stat-value ${_valueClass(room.levels?.temp)}">
            ${room.temp?.toFixed(1) ?? "--"}°C
          </span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-label">Humidity</span>
          <span class="mini-stat-value ${_valueClass(room.levels?.humidity)}">
            ${room.humidity?.toFixed(0) ?? "--"}%
          </span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-label">MQ2 (LPG)</span>
          <span class="mini-stat-value ${_valueClass(room.levels?.mq2)}">
            ${room.mq2 ?? "--"}
          </span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-label">MQ4 (CH₄)</span>
          <span class="mini-stat-value ${_valueClass(room.levels?.mq4)}">
            ${room.mq4 ?? "--"}
          </span>
        </div>
      </div>
      ${alertHTML}
    `
      : `<p class="offline-label">No data received yet</p>`;

    card.innerHTML = `
      <div class="room-bg-number">${room.room}</div>
      <div class="room-card-top">
        <span class="room-label">Room ${room.room}</span>
        <span class="room-status-pill ${_pillClass(status)}">${_pillText(room)}</span>
      </div>
      ${statsHTML}`;

    if (room.online) {
      card.addEventListener("click", () => onClickFn(room.room));
    }

    return card;
  }

  // ── Full render (first load) ─────────────────── //
  function render(rooms, onClickFn) {
    const grid = document.getElementById("room-grid");
    grid.innerHTML = "";
    rooms.forEach((r) => grid.appendChild(_buildCard(r, onClickFn)));
  }

  // ── Update existing cards in-place ──────────── //
  function update(rooms, onClickFn) {
    const grid = document.getElementById("room-grid");
    // If card count changed (shouldn't normally), full re-render
    if (grid.children.length !== rooms.length) {
      render(rooms, onClickFn);
      return;
    }
    // Replace each card element
    rooms.forEach((r, i) => {
      const newCard = _buildCard(r, onClickFn);
      grid.replaceChild(newCard, grid.children[i]);
    });
  }

  return { render, update };
})();

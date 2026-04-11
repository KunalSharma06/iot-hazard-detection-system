/* ════════════════════════════════════════════════
   GAUGE.JS  —  builds SVG ring gauge cards
   ════════════════════════════════════════════════ */

const Gauge = (() => {
  // Circumference of circle r=54
  const CIRC = 2 * Math.PI * 54; // 339.3

  // Convert a 0-1 percentage to dashoffset
  function _offset(pct) {
    return CIRC - Math.min(pct, 1) * CIRC;
  }

  // ── Build the SVG ring + center value HTML ─── //
  function _ringHTML(id, pct, level) {
    return `
      <div class="gauge-ring-wrap">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <circle class="gauge-track" cx="60" cy="60" r="54"/>
          <circle
            id="${id}-fill"
            class="gauge-fill ${level}"
            cx="60" cy="60" r="54"
            style="stroke-dashoffset: ${_offset(pct)};"
          />
        </svg>
        <div class="gauge-center">
          <span class="gauge-val"  id="${id}-val">--</span>
          <span class="gauge-unit" id="${id}-unit"></span>
        </div>
      </div>`;
  }

  // ── Public: build a full gauge card HTML ──── //
  // Options: { id, label, value, unit, pct, level }
  function buildCard(opts) {
    const { id, label, value, unit, pct, level } = opts;
    const statusText =
      level === "danger" ? "DANGER" : level === "warning" ? "WARNING" : "SAFE";

    const card = document.createElement("div");
    card.className = `gauge-card ${level}`;
    card.id = `card-${id}`;
    card.innerHTML = `
      <div class="gauge-sensor-label">${label}</div>
      ${_ringHTML(id, pct, level)}
      <div class="gauge-status-label ${level}">${statusText}</div>`;

    // Set initial val + unit
    card.querySelector(`#${id}-val`).textContent = value ?? "--";
    card.querySelector(`#${id}-unit`).textContent = unit ?? "";

    return card;
  }

  // ── Public: update an existing gauge in-place ─── //
  // Avoids full re-render — only changes numbers and colors
  function updateCard(id, value, unit, pct, level) {
    const card = document.getElementById(`card-${id}`);
    const fill = document.getElementById(`${id}-fill`);
    const valEl = document.getElementById(`${id}-val`);
    const unitEl = document.getElementById(`${id}-unit`);
    const lblEl = card?.querySelector(".gauge-status-label");

    if (!card || !fill || !valEl) return;

    // Update ring
    fill.style.strokeDashoffset = _offset(pct);
    fill.className = `gauge-fill ${level}`;

    // Update value
    valEl.textContent = value ?? "--";
    if (unitEl) unitEl.textContent = unit ?? "";

    // Update card border + bottom bar
    card.className = `gauge-card ${level}`;

    // Update status label
    if (lblEl) {
      const text =
        level === "danger"
          ? "DANGER"
          : level === "warning"
            ? "WARNING"
            : "SAFE";
      lblEl.textContent = text;
      lblEl.className = `gauge-status-label ${level}`;
    }
  }

  // ── Public: build the Flame special card ─── //
  function buildFlameCard(detected) {
    const level = detected ? "danger" : "safe";
    const card = document.createElement("div");
    card.className = `gauge-card ${level}`;
    card.id = "card-flame";
    card.innerHTML = `
      <div class="gauge-sensor-label">Flame Sensor</div>
      <div class="flame-wrap">
        <div class="flame-circle ${level}" id="flame-circle">
          <span>${detected ? "🔥" : "✓"}</span>
        </div>
        <span class="flame-text ${level}" id="flame-text">
          ${detected ? "FLAME DETECTED" : "NO FLAME"}
        </span>
      </div>
      <div class="gauge-status-label ${level}" id="flame-status">
        ${level === "danger" ? "DANGER" : "SAFE"}
      </div>`;
    return card;
  }

  function updateFlameCard(detected) {
    const card = document.getElementById("card-flame");
    const circle = document.getElementById("flame-circle");
    const text = document.getElementById("flame-text");
    const status = document.getElementById("flame-status");
    if (!card) return;

    const level = detected ? "danger" : "safe";
    card.className = `gauge-card ${level}`;
    circle.className = `flame-circle ${level}`;
    circle.querySelector("span").textContent = detected ? "🔥" : "✓";
    text.className = `flame-text ${level}`;
    text.textContent = detected ? "FLAME DETECTED" : "NO FLAME";
    status.className = `gauge-status-label ${level}`;
    status.textContent = level === "danger" ? "DANGER" : "SAFE";
  }

  // ── Public: build Air Quality special card ── //
  function buildAirCard(airQuality, level) {
    const icon =
      airQuality === "Clean" ? "🟢" : airQuality === "Moderate" ? "🟡" : "🔴";
    const card = document.createElement("div");
    card.className = `gauge-card ${level}`;
    card.id = "card-air";
    card.innerHTML = `
      <div class="gauge-sensor-label">Air Quality</div>
      <div class="airq-wrap">
        <div class="airq-icon" id="airq-icon">${icon}</div>
        <div class="airq-value" id="airq-value">${airQuality}</div>
      </div>
      <div class="gauge-status-label ${level}" id="airq-status">
        ${level === "danger" ? "DANGER" : level === "warning" ? "WARNING" : "SAFE"}
      </div>`;
    return card;
  }

  function updateAirCard(airQuality, level) {
    const card = document.getElementById("card-air");
    const icon = document.getElementById("airq-icon");
    const val = document.getElementById("airq-value");
    const status = document.getElementById("airq-status");
    if (!card) return;

    const iconChar =
      airQuality === "Clean" ? "🟢" : airQuality === "Moderate" ? "🟡" : "🔴";
    card.className = `gauge-card ${level}`;
    icon.textContent = iconChar;
    val.textContent = airQuality;
    status.className = `gauge-status-label ${level}`;
    status.textContent =
      level === "danger" ? "DANGER" : level === "warning" ? "WARNING" : "SAFE";
  }

  return {
    CIRC,
    buildCard,
    updateCard,
    buildFlameCard,
    updateFlameCard,
    buildAirCard,
    updateAirCard,
  };
})();

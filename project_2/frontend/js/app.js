(() => {
  // Load saved room from localStorage, or null if none
  let currentRoom = localStorage.getItem("selectedRoom")
    ? parseInt(localStorage.getItem("selectedRoom"))
    : null;
  let pollInterval = null;
  let firstLoad = true;

  // ========== VOICE ALERT SYSTEM ==========
  const VoiceAlertSystem = {
    synth: window.speechSynthesis,
    isSpeaking: false,
    lastAlerts: new Map(),
    alertCooldown: 15000, // 15 seconds cooldown per alert type
    voices: [],
    selectedVoice: null,
    soundEnabled: true,
    audioContext: null,

    init() {
      // Initialize Web Audio API
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();

      // Load voices
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();

      // Add voice control UI
      this.createVoiceControlPanel();
    },

    loadVoices() {
      this.voices = this.synth.getVoices();
      // Prefer English voices, prioritize natural/premium voices
      const preferredVoices = this.voices.filter(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Microsoft") ||
            v.name.includes("Natural")),
      );
      this.selectedVoice =
        preferredVoices[0] ||
        this.voices.find((v) => v.lang.startsWith("en")) ||
        this.voices[0];
    },

    createVoiceControlPanel() {
      const panel = document.createElement("div");
      panel.className = "voice-control-panel";
      panel.innerHTML = `
        <div class="voice-controls">
          <button id="toggle-voice" class="voice-btn active">
            <span class="voice-icon">🔊</span>
            <span class="voice-label">Voice ON</span>
          </button>
          <button id="toggle-sound" class="voice-btn active">
            <span class="voice-icon">🔔</span>
            <span class="voice-label">Sound ON</span>
          </button>
          <button id="test-alert" class="voice-btn">
            <span class="voice-icon">🧪</span>
            <span class="voice-label">Test</span>
          </button>
        </div>
      `;
      document.body.appendChild(panel);

      // Add event listeners
      document.getElementById("toggle-voice").addEventListener("click", () => {
        this.soundEnabled = !this.soundEnabled;
        const btn = document.getElementById("toggle-voice");
        btn.classList.toggle("active");
        btn.querySelector(".voice-label").textContent = this.soundEnabled
          ? "Voice ON"
          : "Voice OFF";
        btn.querySelector(".voice-icon").textContent = this.soundEnabled
          ? "🔊"
          : "🔇";
      });

      document.getElementById("toggle-sound").addEventListener("click", () => {
        const btn = document.getElementById("toggle-sound");
        btn.classList.toggle("active");
        const enabled = btn.classList.contains("active");
        btn.querySelector(".voice-label").textContent = enabled
          ? "Sound ON"
          : "Sound OFF";
        btn.querySelector(".voice-icon").textContent = enabled ? "🔔" : "🔕";
      });

      document.getElementById("test-alert").addEventListener("click", () => {
        this.playAlarmSound("danger");
        this.speak(
          "This is a test alert. All systems functioning normally.",
          1.1,
          1.0,
        );
      });
    },

    speak(message, rate = 1, pitch = 1) {
      if (!this.soundEnabled) return;
      if (this.isSpeaking) this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.voice = this.selectedVoice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;

      utterance.onstart = () => (this.isSpeaking = true);
      utterance.onend = () => (this.isSpeaking = false);
      utterance.onerror = () => (this.isSpeaking = false);

      this.synth.speak(utterance);
    },

    playAlarmSound(level) {
      if (!this.soundEnabled || !this.audioContext) return;

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      if (level === "danger") {
        // High-pitched beep pattern for danger
        const frequencies = [1000, 800, 1000, 800];
        for (let i = 0; i < frequencies.length; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = frequencies[i];
          gain.gain.setValueAtTime(0.3, now + i * 0.1);
          gain.gain.setValueAtTime(0, now + i * 0.1 + 0.1);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.1);
        }
      } else if (level === "warning") {
        // Mid-pitched beep for warning
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 700;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.setValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    },

    checkRoomAlerts(room) {
      const now = Date.now();
      if (!room.alerts) return;

      // Check each alert type
      Object.entries(room.alerts).forEach(([type, isActive]) => {
        if (!isActive) return;

        const alertKey = `${room.room}_${type}`;
        const lastAlert = this.lastAlerts.get(alertKey) || 0;

        // Only alert if cooldown has passed
        if (now - lastAlert < this.alertCooldown) return;

        // Play sound + speak
        const level = room.levels?.[type] || "warning";
        this.playAlarmSound(level);

        const message = this._buildAlertMessage(room, type, level);
        this.speak(message, 1.1, 1);

        this.lastAlerts.set(alertKey, now);
      });
    },

    _buildAlertMessage(room, type, level) {
      const roomNum = room.room;
      const levelText = level === "danger" ? "CRITICAL" : "WARNING";

      const messages = {
        fire: `ALERT! Fire detected in room ${roomNum}. ${levelText}!`,
        mq2: `ALERT! LPG or Smoke detected in room ${roomNum}. ${levelText}!`,
        mq4: `ALERT! Methane gas detected in room ${roomNum}. ${levelText}!`,
        temp: `ALERT! High temperature in room ${roomNum}. ${levelText}!`,
      };

      return messages[type] || `Alert in room ${roomNum}`;
    },
  };

  // ========== ALERT HISTORY SYSTEM ==========
  const AlertHistory = {
    alerts: [],
    maxAlerts: 50,

    add(room, type, level, message) {
      const alert = {
        timestamp: Date.now(),
        room,
        type,
        level,
        message,
      };

      this.alerts.unshift(alert); // Add to front
      if (this.alerts.length > this.maxAlerts) {
        this.alerts.pop(); // Remove oldest
      }

      this.saveToStorage();
      this.updatePanel();
      this.updateBadge();
    },

    saveToStorage() {
      localStorage.setItem("iot_alert_history", JSON.stringify(this.alerts));
    },

    loadFromStorage() {
      try {
        const saved = localStorage.getItem("iot_alert_history");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Filter out alerts older than 24 hours
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          this.alerts = parsed.filter((a) => a.timestamp > oneDayAgo);
        }
      } catch (err) {
        console.error("[ALERT] Load error:", err);
      }
    },

    createPanel() {
      if (document.getElementById("alert-history-panel")) return;

      const panel = document.createElement("div");
      panel.id = "alert-history-panel";
      panel.className = "alert-history-panel";
      panel.innerHTML = `
        <div class="alert-header">
          <h3>Alert History</h3>
          <button id="close-alerts" class="close-btn">✕</button>
        </div>
        <div id="alert-list" class="alert-list"></div>
        <div id="alert-stats" class="alert-stats"></div>
      `;

      document.body.appendChild(panel);

      document.getElementById("close-alerts").addEventListener("click", () => {
        panel.classList.remove("visible");
      });
    },

    updatePanel() {
      const list = document.getElementById("alert-list");
      if (!list) return;

      if (this.alerts.length === 0) {
        list.innerHTML = "<p>No alerts yet</p>";
        return;
      }

      list.innerHTML = this.alerts
        .map(
          (a) => `
        <div class="alert-item alert-${a.level}">
          <span class="alert-time">${new Date(a.timestamp).toLocaleTimeString()}</span>
          <span class="alert-room">Room ${a.room}</span>
          <span class="alert-type">${a.type}</span>
          <span class="alert-level">${a.level}</span>
        </div>
      `,
        )
        .join("");
    },

    updateBadge() {
      const badge = document.querySelector(".alert-badge");
      if (badge) {
        badge.textContent = this.alerts.length;
        badge.classList.toggle("has-alerts", this.alerts.length > 0);
      }
    },

    updateStats() {
      const stats = document.getElementById("alert-stats");
      if (!stats) return;

      const total = this.alerts.length;
      const danger = this.alerts.filter((a) => a.level === "danger").length;
      const warning = this.alerts.filter((a) => a.level === "warning").length;

      stats.innerHTML = `
        <div class="stats">
          <div class="stat">Total: <strong>${total}</strong></div>
          <div class="stat danger">Danger: <strong>${danger}</strong></div>
          <div class="stat warning">Warning: <strong>${warning}</strong></div>
        </div>
      `;
    },

    init() {
      this.loadFromStorage();
      this.createPanel();
      this.updatePanel();
      this.updateBadge();
      this.updateStats(); // FIX: Add this line to show correct alert count
    },
  };

  // ========== UI COMPONENTS ==========
  const RoomsPage = {
    render(rooms, onRoomClick) {
      const container = document.getElementById("rooms-page");
      container.innerHTML = `
        <div class="rooms-grid">
          ${rooms
            .map(
              (room) => `
            <div class="room-card ${room.online ? "" : "offline"}" data-room="${room.room}">
              <h2>Room ${room.room}</h2>
              <div class="room-status">
                ${
                  room.online
                    ? `
                <div class="status-indicator online"></div>
                <span>${room.overallStatus === "danger" ? "🔴 DANGER" : room.overallStatus === "warning" ? "🟡 WARNING" : "🟢 SAFE"}</span>
              `
                    : `
                <div class="status-indicator offline"></div>
                <span>📵 OFFLINE</span>
              `
                }
              </div>
              <p class="room-description">${room.online ? "Click to monitor" : "No data available"}</p>
            </div>
          `,
            )
            .join("")}
        </div>
      `;

      // Add event listeners
      container.querySelectorAll(".room-card").forEach((card) => {
        const roomId = parseInt(card.dataset.room);
        const room = rooms.find((r) => r.room === roomId);
        if (room && room.online) {
          card.addEventListener("click", () => onRoomClick(roomId));
          card.style.cursor = "pointer";
        }
      });
    },

    update(rooms, onRoomClick) {
      this.render(rooms, onRoomClick);
    },
  };

  const DetailPage = {
    currentRoomId: null,

    build(room) {
      const container = document.getElementById("detail-page");
      this.currentRoomId = room.room;

      if (!room.online) {
        container.innerHTML = `
          <div class="detail-header">
            <button class="back-btn">← All Rooms</button>
            <h1>Room ${room.room}</h1>
            <div class="last-update">No data</div>
          </div>
          <div class="detail-content">
            <p style="text-align:center; color:red; font-size:18px;">📵 OFFLINE</p>
            <p style="text-align:center;">No sensor data available</p>
          </div>
        `;
      } else {
        const l = room.levels || {};
        container.innerHTML = `
          <div class="detail-header">
            <button class="back-btn">← All Rooms</button>
            <h1>Room ${room.room}</h1>
            <div class="last-update">Last update: ${new Date(room.lastSeen).toLocaleTimeString()}</div>
          </div>
          <div class="detail-content">
            <div class="sensor-grid">
              <div class="sensor-card ${l.temp}">
                <h3>🌡 Temperature</h3>
                <div class="sensor-value">${room.temp?.toFixed(1)}°C</div>
                <div class="sensor-level">${l.temp}</div>
              </div>
              <div class="sensor-card ${l.humidity}">
                <h3>💧 Humidity</h3>
                <div class="sensor-value">${room.humidity?.toFixed(0)}%</div>
                <div class="sensor-level">${l.humidity}</div>
              </div>
              <div class="sensor-card ${l.mq2}">
                <h3>💨 MQ2 (LPG/Smoke)</h3>
                <div class="sensor-value">${room.mq2}</div>
                <div class="sensor-level">${l.mq2}</div>
              </div>
              <div class="sensor-card ${l.mq4}">
                <h3>⛽ MQ4 (Methane)</h3>
                <div class="sensor-value">${room.mq4}</div>
                <div class="sensor-level">${l.mq4}</div>
              </div>
              <div class="sensor-card ${l.flame}">
                <h3>🔥 Flame</h3>
                <div class="sensor-value">${room.flame ? "DETECTED" : "None"}</div>
                <div class="sensor-level">${room.flame ? "danger" : "safe"}</div>
              </div>
              <div class="sensor-card">
                <h3>🌬 Air Quality</h3>
                <div class="sensor-value">${room.airQuality || "Clean"}</div>
                <div class="sensor-level">info</div>
              </div>
            </div>
          </div>
        `;
      }

      document.querySelector(".back-btn").addEventListener("click", () => {
        showRoomsPage();
      });
    },

    update(room) {
      if (!room.online) {
        this.build(room);
        return;
      }

      const l = room.levels || {};

      // Update each sensor
      const updateSensor = (selector, value, level) => {
        const el = document.querySelector(selector);
        if (el) {
          el.textContent = value;
          el.parentElement.className = `sensor-card ${level}`;
        }
      };

      updateSensor(
        ".sensor-grid .sensor-card:nth-child(1) .sensor-value",
        room.temp?.toFixed(1) + "°C",
        l.temp,
      );
      updateSensor(
        ".sensor-grid .sensor-card:nth-child(1) .sensor-level",
        l.temp,
        l.temp,
      );

      updateSensor(
        ".sensor-grid .sensor-card:nth-child(2) .sensor-value",
        room.humidity?.toFixed(0) + "%",
        l.humidity,
      );
      updateSensor(
        ".sensor-grid .sensor-card:nth-child(2) .sensor-level",
        l.humidity,
        l.humidity,
      );

      updateSensor(
        ".sensor-grid .sensor-card:nth-child(3) .sensor-value",
        room.mq2,
        l.mq2,
      );
      updateSensor(
        ".sensor-grid .sensor-card:nth-child(3) .sensor-level",
        l.mq2,
        l.mq2,
      );

      updateSensor(
        ".sensor-grid .sensor-card:nth-child(4) .sensor-value",
        room.mq4,
        l.mq4,
      );
      updateSensor(
        ".sensor-grid .sensor-card:nth-child(4) .sensor-level",
        l.mq4,
        l.mq4,
      );

      updateSensor(
        ".sensor-grid .sensor-card:nth-child(5) .sensor-value",
        room.flame ? "DETECTED" : "None",
        l.flame,
      );
      updateSensor(
        ".sensor-grid .sensor-card:nth-child(5) .sensor-level",
        l.flame,
        l.flame,
      );

      // Update last update time
      const timeEl = document.querySelector(".last-update");
      if (timeEl) {
        timeEl.textContent = `Last update: ${new Date(room.lastSeen).toLocaleTimeString()}`;
      }
    },

    reset() {
      this.currentRoomId = null;
    },
  };

  // ────────────────────────────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────────────────────────────

  function showRoomsPage() {
    currentRoom = null;
    localStorage.removeItem("selectedRoom"); // FIX: Clear saved room
    DetailPage.reset();
    document.getElementById("rooms-page").classList.remove("hidden");
    document.getElementById("detail-page").classList.add("hidden");
  }

  function showDetailPage(roomId) {
    currentRoom = roomId;
    localStorage.setItem("selectedRoom", roomId); // FIX: Save room to localStorage
    document.getElementById("rooms-page").classList.add("hidden");
    document.getElementById("detail-page").classList.remove("hidden");
  }

  // ────────────────────────────────────────────────────────────────
  // Main Polling Loop
  // ────────────────────────────────────────────────────────────────

  async function poll() {
    try {
      const rooms = await API.fetchAllRooms();

      const room1 = rooms.find((r) => r.room === 1);
      const room2 = rooms.find((r) => r.room === 2);
      const room3 = rooms.find((r) => r.room === 3);

      // Check alerts for each room
      if (room1) VoiceAlertSystem.checkRoomAlerts(room1);
      if (room2) VoiceAlertSystem.checkRoomAlerts(room2);

      if (room3) {
        room3.roomsData = { room1, room2 };
        room3.online = (room1 && room1.online) || (room2 && room2.online);

        if (
          room1?.overallStatus === "danger" ||
          room2?.overallStatus === "danger"
        ) {
          room3.overallStatus = "danger";
        } else if (
          room1?.overallStatus === "warning" ||
          room2?.overallStatus === "warning"
        ) {
          room3.overallStatus = "warning";
        } else {
          room3.overallStatus = "safe";
        }
      }

      // Update header timestamp - SUCCESS
      const now = new Date();
      document.getElementById("last-update").textContent =
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

      if (currentRoom === null) {
        // Rooms page
        if (firstLoad) {
          RoomsPage.render(rooms, showDetailPage);
          firstLoad = false;
        } else RoomsPage.update(rooms, showDetailPage);
      } else {
        // Detail page
        let room = rooms.find((r) => r.room === currentRoom);

        if (room) {
          if (currentRoom === 3) {
            room = {
              ...room,
              roomsData: { room1, room2 },
            };
          }

          if (firstLoad) {
            DetailPage.build(room);
            firstLoad = false;
          } else {
            DetailPage.update(room);
          }
        }
      }
    } catch (err) {
      console.error("[POLL ERROR]", err.message);
      document.getElementById("last-update").textContent = "Connection lost";
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Initialization
  // ────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    // Initialize systems
    VoiceAlertSystem.init();
    AlertHistory.init();

    // Add alert history button
    const header = document.querySelector("header");
    const alertBtn = document.createElement("button");
    alertBtn.className = "alert-history-btn";
    alertBtn.innerHTML = `📋 <span class="alert-badge">0</span>`;
    alertBtn.addEventListener("click", () => {
      document
        .getElementById("alert-history-panel")
        .classList.toggle("visible");
    });
    header.appendChild(alertBtn);

    // Back button handler
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("back-btn")) {
        showRoomsPage();
      }
    });

    // Start polling
    poll();
    pollInterval = setInterval(poll, 2000);

    // FIX: Restore room if it was saved
    if (currentRoom !== null) {
      showDetailPage(currentRoom);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Cleanup
  // ────────────────────────────────────────────────────────────────

  window.addEventListener("beforeunload", () => {
    if (pollInterval) clearInterval(pollInterval);
  });
})();

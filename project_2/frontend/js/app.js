(() => {
  // FIX #1: Load saved room from localStorage
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

    // Play alarm sound using Web Audio API
    playAlarmSound(level) {
      if (!document.getElementById("toggle-sound").classList.contains("active"))
        return;

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      if (level === "danger") {
        // Danger: Rapid siren-like beeps
        for (let i = 0; i < 6; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.frequency.value = i % 2 === 0 ? 800 : 600;
          osc.type = "square";

          gain.gain.setValueAtTime(0, now + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.01);
          gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.12);

          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.12);
        }
      } else if (level === "warning") {
        // Warning: Double beep
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.frequency.value = 600;
          osc.type = "sine";

          gain.gain.setValueAtTime(0, now + i * 0.2);
          gain.gain.linearRampToValueAtTime(0.2, now + i * 0.2 + 0.01);
          gain.gain.linearRampToValueAtTime(0, now + i * 0.2 + 0.1);

          osc.start(now + i * 0.2);
          osc.stop(now + i * 0.2 + 0.1);
        }
      }
    },

    speak(text, rate = 1.0, pitch = 1.0, volume = 1.0) {
      if (!this.soundEnabled || !text) return;

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.selectedVoice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onstart = () => {
        this.isSpeaking = true;
      };
      utterance.onend = () => {
        this.isSpeaking = false;
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
      };

      this.synth.speak(utterance);
    },

    announceAlert(room, alertType, details) {
      const alertKey = `${room.room}-${alertType}`;
      const now = Date.now();

      // Check cooldown
      if (this.lastAlerts.has(alertKey)) {
        const lastTime = this.lastAlerts.get(alertKey);
        if (now - lastTime < this.alertCooldown) {
          return; // Don't spam alerts
        }
      }

      this.lastAlerts.set(alertKey, now);

      let message = "";
      let level = "";

      if (alertType === "fire") {
        level = "danger";
        message = `CRITICAL ALERT! FIRE DETECTED IN ROOM ${room.room}! FLAME SENSOR ACTIVATED! EVACUATE IMMEDIATELY! REPEAT, FIRE IN ROOM ${room.room}!`;
        this.playAlarmSound("danger");
        this.createVisualAlert("FIRE DETECTED", `Room ${room.room}`, "danger");
      } else if (alertType === "mq2") {
        level = "danger";
        const value = room.mq2;
        message = `DANGER! HIGH LPG OR SMOKE DETECTED IN ROOM ${room.room}! CURRENT READING: ${value} ADC UNITS! VENTILATE AREA IMMEDIATELY! CHECK FOR GAS LEAKS!`;
        this.playAlarmSound("danger");
        this.createVisualAlert(
          "GAS/SMOKE ALERT",
          `Room ${room.room} - ${value} ADC`,
          "danger",
        );
      } else if (alertType === "mq4") {
        level = "danger";
        const value = room.mq4;
        message = `DANGER! HIGH METHANE OR CNG DETECTED IN ROOM ${room.room}! CURRENT READING: ${value} ADC UNITS! POTENTIAL GAS LEAK! EVACUATE AND VENTILATE!`;
        this.playAlarmSound("danger");
        this.createVisualAlert(
          "METHANE ALERT",
          `Room ${room.room} - ${value} ADC`,
          "danger",
        );
      } else if (alertType === "temp") {
        level = room.levels.temp === "danger" ? "danger" : "warning";
        const value = room.temp.toFixed(1);
        if (level === "danger") {
          message = `CRITICAL TEMPERATURE ALERT! ROOM ${room.room} TEMPERATURE IS ${value} DEGREES CELSIUS! THIS IS DANGEROUSLY HIGH! RISK OF HEAT DAMAGE OR FIRE!`;
          this.playAlarmSound("danger");
          this.createVisualAlert(
            "HIGH TEMPERATURE",
            `Room ${room.room} - ${value}°C`,
            "danger",
          );
        } else {
          message = `WARNING! ELEVATED TEMPERATURE IN ROOM ${room.room}. CURRENT READING: ${value} DEGREES CELSIUS. MONITOR CLOSELY.`;
          this.playAlarmSound("warning");
          this.createVisualAlert(
            "Temperature Warning",
            `Room ${room.room} - ${value}°C`,
            "warning",
          );
        }
      } else if (alertType === "humidity") {
        level = room.levels.humidity === "danger" ? "danger" : "warning";
        const value = room.humidity.toFixed(0);
        message = `${level === "danger" ? "DANGER" : "WARNING"}! ${level === "danger" ? "EXTREME" : "HIGH"} HUMIDITY IN ROOM ${room.room}. CURRENT LEVEL: ${value} PERCENT. ${level === "danger" ? "RISK OF MOLD AND DAMAGE!" : "CHECK VENTILATION."}`;
        this.playAlarmSound(level);
        this.createVisualAlert(
          "Humidity Alert",
          `Room ${room.room} - ${value}%`,
          level,
        );
      }

      // Speak the alert with appropriate urgency
      const rate = level === "danger" ? 1.1 : 0.95;
      const pitch = level === "danger" ? 1.1 : 1.0;
      this.speak(message, rate, pitch, 1.0);

      // Add to alert history
      AlertHistory.addAlert({
        room: room.room,
        type: alertType,
        level: level,
        message: message,
        timestamp: now,
      });
    },

    createVisualAlert(title, subtitle, level) {
      const alert = document.createElement("div");
      alert.className = `visual-alert ${level}`;
      alert.innerHTML = `
        <div class="visual-alert-content">
          <div class="visual-alert-icon">${level === "danger" ? "🚨" : "⚠️"}</div>
          <div class="visual-alert-text">
            <div class="visual-alert-title">${title}</div>
            <div class="visual-alert-subtitle">${subtitle}</div>
          </div>
          <button class="visual-alert-dismiss">✕</button>
        </div>
      `;

      document.body.appendChild(alert);

      // Animate in
      setTimeout(() => alert.classList.add("show"), 10);

      // Dismiss button
      alert
        .querySelector(".visual-alert-dismiss")
        .addEventListener("click", () => {
          alert.classList.remove("show");
          setTimeout(() => alert.remove(), 300);
        });

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        if (alert.parentNode) {
          alert.classList.remove("show");
          setTimeout(() => alert.remove(), 300);
        }
      }, 10000);
    },

    checkRoomAlerts(room) {
      if (!room || !room.online) return;

      // Check fire
      if (room.flame === 1 && room.alerts?.fire) {
        this.announceAlert(room, "fire");
      }

      // Check gas sensors
      if (room.levels?.mq2 === "danger" && room.alerts?.mq2) {
        this.announceAlert(room, "mq2");
      }
      if (room.levels?.mq4 === "danger" && room.alerts?.mq4) {
        this.announceAlert(room, "mq4");
      }

      // Check temperature
      if (
        (room.levels?.temp === "danger" || room.levels?.temp === "warning") &&
        room.alerts?.temp
      ) {
        this.announceAlert(room, "temp");
      }

      // Check humidity
      if (
        (room.levels?.humidity === "danger" ||
          room.levels?.humidity === "warning") &&
        room.alerts?.humidity
      ) {
        this.announceAlert(room, "humidity");
      }
    },
  };

  // ========== ALERT HISTORY SYSTEM ==========
  const AlertHistory = {
    alerts: [],
    maxAlerts: 50,
    panelOpen: false,
    storageKey: "iot_alert_history",

    init() {
      this.loadFromStorage();
      this.createPanel();
      this.updatePanel();
      this.updateBadge();
      this.updateStats(); // FIX #2: Add this to show correct alert count
    },

    // Load alerts from localStorage
    loadFromStorage() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.alerts = JSON.parse(stored);
          // Remove old alerts (older than 24 hours)
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          this.alerts = this.alerts.filter(
            (alert) => alert.timestamp > oneDayAgo,
          );
        }
      } catch (error) {
        console.error("Failed to load alert history:", error);
        this.alerts = [];
      }
    },

    // Save alerts to localStorage
    saveToStorage() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.alerts));
      } catch (error) {
        console.error("Failed to save alert history:", error);
      }
    },

    createPanel() {
      const panel = document.createElement("div");
      panel.id = "alert-history-panel";
      panel.className = "alert-history-panel";
      panel.innerHTML = `
      <div class="alert-history-header">
        <h3>Alert History</h3>
        <div class="alert-header-actions">
          <button id="export-history" class="export-btn" title="Export to CSV">📥</button>
          <button id="clear-history" class="clear-btn">Clear</button>
          <button id="close-history" class="close-btn">✕</button>
        </div>
      </div>
      <div class="alert-history-stats" id="alert-stats">
        <div class="stat-item">
          <span class="stat-label">Total</span>
          <span class="stat-value" id="stat-total">0</span>
        </div>
        <div class="stat-item danger">
          <span class="stat-label">Danger</span>
          <span class="stat-value" id="stat-danger">0</span>
        </div>
        <div class="stat-item warning">
          <span class="stat-label">Warning</span>
          <span class="stat-value" id="stat-warning">0</span>
        </div>
      </div>
      <div class="alert-history-list" id="alert-history-list">
        <div class="alert-history-empty">No alerts yet</div>
      </div>
    `;
      document.body.appendChild(panel);

      // Create toggle button
      const toggleBtn = document.createElement("button");
      toggleBtn.id = "toggle-history";
      toggleBtn.className = "toggle-history-btn";
      toggleBtn.innerHTML = `
      <span class="history-icon">📋</span>
      <span class="alert-count">0</span>
    `;
      document.body.appendChild(toggleBtn);

      // Event listeners
      toggleBtn.addEventListener("click", () => this.togglePanel());
      document
        .getElementById("close-history")
        .addEventListener("click", () => this.togglePanel());
      document
        .getElementById("clear-history")
        .addEventListener("click", () => this.clearHistory());
      document
        .getElementById("export-history")
        .addEventListener("click", () => this.exportToCSV());
    },

    togglePanel() {
      this.panelOpen = !this.panelOpen;
      const panel = document.getElementById("alert-history-panel");
      panel.classList.toggle("open", this.panelOpen);
    },

    addAlert(alert) {
      // Check if this exact alert already exists in last 5 seconds (prevent duplicates)
      const isDuplicate = this.alerts.some(
        (existingAlert) =>
          existingAlert.room === alert.room &&
          existingAlert.type === alert.type &&
          existingAlert.level === alert.level &&
          alert.timestamp - existingAlert.timestamp < 5000,
      );

      if (isDuplicate) return;

      this.alerts.unshift(alert);
      if (this.alerts.length > this.maxAlerts) {
        this.alerts = this.alerts.slice(0, this.maxAlerts);
      }

      this.saveToStorage(); // Save to localStorage
      this.updatePanel();
      this.updateBadge();
      this.updateStats();
    },

    updatePanel() {
      const list = document.getElementById("alert-history-list");
      if (this.alerts.length === 0) {
        list.innerHTML = '<div class="alert-history-empty">No alerts yet</div>';
        return;
      }

      list.innerHTML = this.alerts
        .map((alert, index) => {
          const time = new Date(alert.timestamp);
          const timeAgo = this.getTimeAgo(alert.timestamp);
          return `
        <div class="alert-history-item ${alert.level}" data-index="${index}">
          <div class="alert-history-item-header">
            <span class="alert-history-icon">${alert.level === "danger" ? "🚨" : "⚠️"}</span>
            <span class="alert-history-type">${this.getAlertTypeName(alert.type)}</span>
            <span class="alert-history-room">Room ${alert.room}</span>
            <span class="alert-history-time" title="${time.toLocaleString()}">${timeAgo}</span>
            <button class="delete-alert-btn" data-index="${index}" title="Delete">🗑️</button>
          </div>
          <div class="alert-history-message">${this.truncateMessage(alert.message)}</div>
          <div class="alert-history-timestamp">${time.toLocaleDateString()} ${time.toLocaleTimeString()}</div>
        </div>
      `;
        })
        .join("");

      // Add delete button listeners
      list.querySelectorAll(".delete-alert-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          this.deleteAlert(index);
        });
      });
    },

    getTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);

      if (seconds < 60) return "Just now";
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    truncateMessage(message) {
      return message.length > 150 ? message.substring(0, 150) + "..." : message;
    },

    getAlertTypeName(type) {
      const names = {
        fire: "Fire",
        mq2: "LPG/Smoke",
        mq4: "Methane",
        temp: "Temperature",
        humidity: "Humidity",
      };
      return names[type] || type;
    },

    updateBadge() {
      const badge = document.querySelector(".alert-count");
      if (badge) {
        badge.textContent = this.alerts.length;
        badge.style.display = this.alerts.length > 0 ? "flex" : "none";
      }
    },

    updateStats() {
      const dangerCount = this.alerts.filter(
        (a) => a.level === "danger",
      ).length;
      const warningCount = this.alerts.filter(
        (a) => a.level === "warning",
      ).length;

      document.getElementById("stat-total").textContent = this.alerts.length;
      document.getElementById("stat-danger").textContent = dangerCount;
      document.getElementById("stat-warning").textContent = warningCount;
    },

    deleteAlert(index) {
      this.alerts.splice(index, 1);
      this.saveToStorage();
      this.updatePanel();
      this.updateBadge();
      this.updateStats();
    },

    clearHistory() {
      if (confirm("Clear all alert history? This cannot be undone.")) {
        this.alerts = [];
        this.saveToStorage();
        this.updatePanel();
        this.updateBadge();
        this.updateStats();
      }
    },

    exportToCSV() {
      if (this.alerts.length === 0) {
        alert("No alerts to export");
        return;
      }

      const csvContent = [
        ["Timestamp", "Room", "Type", "Level", "Message"].join(","),
        ...this.alerts.map((alert) => {
          const time = new Date(alert.timestamp).toLocaleString();
          const message = alert.message.replace(/,/g, ";").replace(/"/g, '""');
          return [
            `"${time}"`,
            alert.room,
            this.getAlertTypeName(alert.type),
            alert.level,
            `"${message}"`,
          ].join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const filename = `iot-alerts-${new Date().toISOString().split("T")[0]}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  };

  // ── Navigation ───────────────────────────────── //
  function showRoomsPage() {
    currentRoom = null;
    localStorage.removeItem("selectedRoom"); // FIX #1: Clear saved room
    DetailPage.reset();
    document.getElementById("rooms-page").classList.remove("hidden");
    document.getElementById("detail-page").classList.add("hidden");
  }

  function showDetailPage(roomId) {
    currentRoom = roomId;
    localStorage.setItem("selectedRoom", roomId); // FIX #1: Save room
    document.getElementById("rooms-page").classList.add("hidden");
    document.getElementById("detail-page").classList.remove("hidden");
  }

  // ── Polling ──────────────────────────────────── //
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
        room3.roomsData = {
          room1,
          room2,
        };

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

      // Update header timestamp
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
          // Room 3 gets all room data
          if (currentRoom === 3) {
            room = {
              ...room,
              roomsData: {
                room1,
                room2,
              },
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

  // ── Init ─────────────────────────────────────── //
  function init() {
    // Initialize voice and alert systems
    VoiceAlertSystem.init();
    AlertHistory.init();

    document.getElementById("back-btn").addEventListener("click", () => {
      firstLoad = true;
      showRoomsPage();
    });

    poll();
    pollInterval = setInterval(poll, 2000);

    // FIX #1: Restore room if it was saved
    if (currentRoom !== null) {
      showDetailPage(currentRoom);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

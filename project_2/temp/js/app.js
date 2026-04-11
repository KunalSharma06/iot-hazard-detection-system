(() => {
  let currentRoom = null; // null = rooms page, number = detail page
  let pollInterval = null;
  let firstLoad = true;

  // ── Navigation ───────────────────────────────── //
  function showRoomsPage() {
    currentRoom = null;
    DetailPage.reset();
    document.getElementById("rooms-page").classList.remove("hidden");
    document.getElementById("detail-page").classList.add("hidden");
  }

  function showDetailPage(roomId) {
    currentRoom = roomId;
    document.getElementById("rooms-page").classList.add("hidden");
    document.getElementById("detail-page").classList.remove("hidden");
  }

  // ── Polling ──────────────────────────────────── //
  async function poll() {
    try {
      const rooms = await API.fetchAllRooms();

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
        // Detail page — find this room in the batch
        const room = rooms.find((r) => r.room === currentRoom);
        if (room) {
          if (firstLoad) {
            DetailPage.build(room);
            firstLoad = false;
          } else DetailPage.update(room);
        }
      }
    } catch (err) {
      console.error("[POLL ERROR]", err.message);
      document.getElementById("last-update").textContent = "Connection lost";
    }
  }

  // ── Init ─────────────────────────────────────── //
  function init() {
    document.getElementById("back-btn").addEventListener("click", () => {
      firstLoad = true;
      showRoomsPage();
    });

    poll(); // immediate first fetch
    pollInterval = setInterval(poll, 2000); // then every 2 seconds
  }

  document.addEventListener("DOMContentLoaded", init);
})();

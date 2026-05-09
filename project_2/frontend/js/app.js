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

     // ===== ADD THIS HERE =====
     const room1 = rooms.find((r) => r.room === 1);
     const room2 = rooms.find((r) => r.room === 2);
     const room3 = rooms.find((r) => r.room === 3);

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
     // ===== END =====

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
    document.getElementById("back-btn").addEventListener("click", () => {
      firstLoad = true;
      showRoomsPage();
    });

    poll(); // immediate first fetch
    pollInterval = setInterval(poll, 2000); // then every 2 seconds
  }

  document.addEventListener("DOMContentLoaded", init);
})();

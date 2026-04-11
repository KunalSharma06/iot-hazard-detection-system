const API = (() => {
  const BASE = "/api";

  // GET /api/rooms  — returns array of all room objects
  async function fetchAllRooms() {
    const res = await fetch(`${BASE}/rooms`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to fetch rooms");
    return data.rooms;
  }

  // GET /api/rooms/:id  — returns single room object
  async function fetchRoom(id) {
    const res = await fetch(`${BASE}/rooms/${id}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || `Failed to fetch room ${id}`);
    return data.room;
  }

  return { fetchAllRooms, fetchRoom };
})();

// ─── Room Controller ──────────────────────────────────────────
// Handles GET /api/rooms       → all rooms
// Handles GET /api/rooms/:id   → single room

const roomStore = require("../models/roomstore.js");

// GET /api/rooms
function getAllRooms(req, res, next) {
  try {
    const rooms = roomStore.getAllRooms(3); // 3 rooms total
    res.json({ ok: true, rooms });
  } catch (err) {
    next(err);
  }
}

// GET /api/rooms/:id
function getRoomById(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const room = roomStore.getRoom(id);

    if (!room) {
      return res.status(404).json({
        ok: false,
        error: `Room ${id} not found or has never sent data`,
      });
    }

    res.json({ ok: true, room });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllRooms, getRoomById };

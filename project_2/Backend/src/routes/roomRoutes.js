// ─── Room Routes ─────────────────────────────────────────────
// Mounted at /api/rooms

const express = require("express");
const router = express.Router();
const roomCtrl = require("../controllers/roomController");

// GET /api/rooms          — all rooms (used by dashboard home page)
router.get("/", roomCtrl.getAllRooms);

// GET /api/rooms/:id      — single room detail
router.get("/:id", roomCtrl.getRoomById);

module.exports = router;

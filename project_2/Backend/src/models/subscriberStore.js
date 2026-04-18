// ─── Subscriber Store ─────────────────────────────────────────
// Holds chat IDs of everyone who subscribed via the bot.
// Uses a Set so no duplicates are possible.
// Note: data lives in memory — restarting server clears subscribers.
// For persistence, swap the Set for a JSON file read/write.

const subscribers = new Set();

function add(chatId) {
  subscribers.add(String(chatId));
}

function remove(chatId) {
  subscribers.delete(String(chatId));
}

function has(chatId) {
  return subscribers.has(String(chatId));
}

// Returns array of all subscribed chat IDs
function getAll() {
  return Array.from(subscribers);
}

function count() {
  return subscribers.size;
}

module.exports = { add, remove, has, getAll, count };
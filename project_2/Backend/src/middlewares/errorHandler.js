// ─── Global Error Handler Middleware ─────────────────────────
// Catches any error passed via next(err) in controllers

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    ok: false,
    error: message,
  });
}

module.exports = errorHandler;

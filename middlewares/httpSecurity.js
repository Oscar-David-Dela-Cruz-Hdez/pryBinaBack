const cors = require("cors");

// Exact browser origins only. Mobile clients and server-to-server calls have no
// Origin header and still require the existing authentication on private routes.
function allowedOrigins(value = "") {
  const origins = value.split(",").map(origin => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error("CORS_ALLOWED_ORIGINS contiene un origen inválido"); }
    if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin || url.hostname.includes("*")) {
      throw new Error("CORS_ALLOWED_ORIGINS debe contener orígenes exactos sin rutas ni comodines");
    }
  }
  return new Set(origins);
}

function configureHttpSecurity(app, env = process.env) {
  const origins = allowedOrigins(env.CORS_ALLOWED_ORIGINS);
  app.disable("x-powered-by");
  // Render terminates TLS at its reverse proxy. Trust only that nearest hop.
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }
    res.vary("Origin");
    const origin = req.get("Origin");
    if (origin && !origins.has(origin)) {
      return res.status(403).json({ error: "Origen no autorizado" });
    }
    next();
  });
  app.use(cors({
    origin: (origin, callback) => callback(null, Boolean(origin && origins.has(origin))),
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "ngsw-bypass"],
    optionsSuccessStatus: 204,
    maxAge: 600,
  }));
}

function apiNotFound(_req, res) {
  res.status(404).json({ error: "Ruta API no encontrada" });
}

function apiErrorHandler(error, req, res, next) {
  if (res.headersSent || !(req.path === "/api" || req.path.startsWith("/api/"))) {
    return next(error);
  }
  const candidate = error.statusCode ?? error.status;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate < 600
    ? candidate : error instanceof URIError ? 400 : 500;
  // Never return stack traces, raw bodies, database errors or credentials.
  const message = status === 413 ? "Solicitud demasiado grande"
    : status >= 500 ? "Error interno del servidor" : "Solicitud inválida";
  res.status(status).json({ error: message });
}

module.exports = { allowedOrigins, configureHttpSecurity, apiNotFound, apiErrorHandler };

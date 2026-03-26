/**
 * Middleware de métricas HTTP
 * Captura: total de requests, latencia promedio, conteo de errores 4xx/5xx
 * Guarda historial circular de 60 snapshots para gráficas de línea
 */

// ── Contadores globales en memoria ──────────────────────────────────────────
const httpMetrics = {
  totalRequests: 0,
  errores4xx: 0,
  errores5xx: 0,
  latenciasMs: [],          // últimas 200 latencias (para calcular promedio móvil)
  requestsPorRuta: {},      // { "GET /api/productos": 12, ... }
  historial: [],            // hasta 60 snapshots, uno cada ~10 s
};

// ── Snapshot periódico (cada 10 segundos) ───────────────────────────────────
const INTERVALO_SNAPSHOT_MS = 10_000;
const MAX_SNAPSHOTS = 60;

setInterval(() => {
  const latAvg =
    httpMetrics.latenciasMs.length > 0
      ? Math.round(
          httpMetrics.latenciasMs.reduce((a, b) => a + b, 0) /
            httpMetrics.latenciasMs.length
        )
      : 0;

  httpMetrics.historial.push({
    timestamp: new Date().toISOString(),
    totalRequests: httpMetrics.totalRequests,
    errores4xx: httpMetrics.errores4xx,
    errores5xx: httpMetrics.errores5xx,
    latenciaPromedioMs: latAvg,
  });

  // Mantener sólo los últimos MAX_SNAPSHOTS puntos
  if (httpMetrics.historial.length > MAX_SNAPSHOTS) {
    httpMetrics.historial.shift();
  }

  // Limpiar latencias para el próximo intervalo
  httpMetrics.latenciasMs = [];
}, INTERVALO_SNAPSHOT_MS);

// ── Middleware principal ─────────────────────────────────────────────────────
const httpMetricsMiddleware = (req, res, next) => {
  const inicio = Date.now();

  res.on("finish", () => {
    const duracion = Date.now() - inicio;
    const status = res.statusCode;
    const clave = `${req.method} ${req.route ? req.route.path : req.path}`;

    httpMetrics.totalRequests += 1;
    httpMetrics.latenciasMs.push(duracion);

    if (status >= 400 && status < 500) httpMetrics.errores4xx += 1;
    if (status >= 500) httpMetrics.errores5xx += 1;

    httpMetrics.requestsPorRuta[clave] =
      (httpMetrics.requestsPorRuta[clave] ?? 0) + 1;
  });

  next();
};

module.exports = { httpMetricsMiddleware, httpMetrics };

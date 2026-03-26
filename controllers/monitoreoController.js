const {
  obtenerMetricasSistema,
  obtenerMetricasMongo,
  historialSistema,
} = require("../services/monitoreoService");

const { httpMetrics } = require("../middlewares/httpMetricsMiddleware");

// GET /api/monitoreo/sistema
const getSistema = (req, res) => {
  const metricas = obtenerMetricasSistema();
  res.json(metricas);
};

// GET /api/monitoreo/mongodb
const getMongo = async (req, res) => {
  const metricas = await obtenerMetricasMongo();
  res.json(metricas);
};

// GET /api/monitoreo/http
const getHttp = (req, res) => {
  const latenciasMs = httpMetrics.latenciasMs;
  const latenciaPromedio =
    latenciasMs.length > 0
      ? Math.round(latenciasMs.reduce((a, b) => a + b, 0) / latenciasMs.length)
      : 0;

  res.json({
    timestamp: new Date().toISOString(),
    totalRequests: httpMetrics.totalRequests,
    errores4xx: httpMetrics.errores4xx,
    errores5xx: httpMetrics.errores5xx,
    latenciaPromedioMs: latenciaPromedio,
    topRutas: Object.entries(httpMetrics.requestsPorRuta)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ruta, total]) => ({ ruta, total })),
  });
};

// GET /api/monitoreo/historial
// Devuelve historial combinado: sistema + http por timestamp
const getHistorial = (req, res) => {
  // El historial de http se fusiona sobre el historial del sistema
  const httpHist = httpMetrics.historial;

  const combinado = historialSistema.map((snap, idx) => ({
    ...snap,
    http: httpHist[idx] ?? null,
  }));

  res.json({
    total: combinado.length,
    intervaloSegundos: 10,
    datos: combinado,
  });
};

// GET /api/monitoreo/resumen
// Endpoint "all-in-one" para cargar el dashboard de una sola petición
const getResumen = async (req, res) => {
  const [sistema, mongo] = await Promise.all([
    obtenerMetricasSistema(),
    obtenerMetricasMongo(),
  ]);

  const latencias = httpMetrics.latenciasMs;
  const latenciaPromedio =
    latencias.length > 0
      ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length)
      : 0;

  res.json({
    timestamp: new Date().toISOString(),
    sistema,
    mongo,
    http: {
      totalRequests: httpMetrics.totalRequests,
      errores4xx: httpMetrics.errores4xx,
      errores5xx: httpMetrics.errores5xx,
      latenciaPromedioMs: latenciaPromedio,
    },
    historialPuntos: historialSistema.length,
  });
};

module.exports = { getSistema, getMongo, getHttp, getHistorial, getResumen };

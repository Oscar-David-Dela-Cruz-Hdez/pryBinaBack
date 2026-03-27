/**
 * Servicio de monitoreo del sistema
 * Recolecta métricas de CPU, RAM, Node.js heap y MongoDB
 * Usa SÓLO módulos nativos de Node.js + mongoose (sin dependencias extra)
 */

const os = require("os");
const mongoose = require("mongoose");

// ── Contadores propios a nivel de aplicación ────────────────────────────────
// Necesario porque los drivers modernos de Mongoose envían deletes como
// "comandos" (command protocol), por lo que opcounters.delete siempre es 0.
const appCounters = {
  deletes: 0,
};

// Plugin global de Mongoose: intercepta TODOS los modelos sin tocar cada uno
mongoose.plugin((schema) => {
  schema.post("deleteOne",      { document: false, query: true }, () => { appCounters.deletes++; });
  schema.post("deleteMany",     { document: false, query: true }, () => { appCounters.deletes++; });
  schema.post("findOneAndDelete", { document: true, query: true }, (doc) => { if (doc) appCounters.deletes++; });
});

// ── Historial circular del sistema ──────────────────────────────────────────
const MAX_HISTORIAL = 60;
const historialSistema = [];

// ── CPU: cálculo con diferencia de tiempos idle/total ───────────────────────
let cpuPrevio = null;

const calcularUsoCPU = () => {
  const cpus = os.cpus();

  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const tipo of Object.values(cpu.times)) {
      totalTick += tipo;
    }
    totalIdle += cpu.times.idle;
  }

  if (!cpuPrevio) {
    cpuPrevio = { totalIdle, totalTick };
    return 0;
  }

  const idleDiff = totalIdle - cpuPrevio.totalIdle;
  const totalDiff = totalTick - cpuPrevio.totalTick;

  cpuPrevio = { totalIdle, totalTick };

  const usoPct = totalDiff === 0 ? 0 : ((1 - idleDiff / totalDiff) * 100);
  return Math.round(usoPct * 100) / 100; // 2 decimales
};

// ── Snapshot de métricas del sistema ────────────────────────────────────────
const obtenerMetricasSistema = () => {
  const memTotal = os.totalmem();
  const memLibre = os.freemem();
  const memUsada = memTotal - memLibre;
  const heap = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    cpu: {
      usoPorcentaje: calcularUsoCPU(),
      nucleos: os.cpus().length,
      modelo: os.cpus()[0]?.model ?? "desconocido",
    },
    ram: {
      totalMb: Math.round(memTotal / 1_048_576),
      usadaMb: Math.round(memUsada / 1_048_576),
      libreMb: Math.round(memLibre / 1_048_576),
      usoPorcentaje: Math.round((memUsada / memTotal) * 100 * 100) / 100,
    },
    nodejs: {
      heapUsadoMb: Math.round(heap.heapUsed / 1_048_576),
      heapTotalMb: Math.round(heap.heapTotal / 1_048_576),
      rssMb: Math.round(heap.rss / 1_048_576),
      uptimeSegundos: Math.round(process.uptime()),
    },
    sistema: {
      uptimeSegundos: Math.round(os.uptime()),
      plataforma: os.platform(),
      version: os.version?.() ?? os.release(),
    },
  };
};

// ── Métricas de MongoDB ─────────────────────────────────────────────────────
const obtenerMetricasMongo = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return { error: "MongoDB no conectado aún" };
    }

    const status = await db.command({ serverStatus: 1 });

    return {
      timestamp: new Date().toISOString(),
      conexiones: {
        actuales: status.connections?.current ?? 0,
        disponibles: status.connections?.available ?? 0,
        totalCreadas: status.connections?.totalCreated ?? 0,
      },
      operaciones: {
        inserts: status.opcounters?.insert ?? 0,
        queries: status.opcounters?.query ?? 0,
        updates: status.opcounters?.update ?? 0,
        // opcounters.delete siempre es 0 con drivers modernos (usan command protocol).
        // Usamos nuestro contador propio capturado desde el plugin de Mongoose.
        deletes: appCounters.deletes,
        commands: status.opcounters?.command ?? 0,
      },
      red: {
        bytesEntradaKb: Math.round((status.network?.bytesIn ?? 0) / 1024),
        bytesSalidaKb: Math.round((status.network?.bytesOut ?? 0) / 1024),
        totalRequests: status.network?.numRequests ?? 0,
      },
      uptime: {
        segundos: status.uptimeMillis ? Math.round(status.uptimeMillis / 1000) : 0,
      },
      version: status.version ?? "desconocida",
    };
  } catch (error) {
    return { error: `Error al obtener stats de MongoDB: ${error.message}` };
  }
};

// ── Snapshot periódico cada 10 segundos ─────────────────────────────────────
const INTERVALO_MS = 10_000;

setInterval(() => {
  const snap = obtenerMetricasSistema();
  historialSistema.push(snap);
  if (historialSistema.length > MAX_HISTORIAL) {
    historialSistema.shift();
  }
}, INTERVALO_MS);

// Primer snapshot inmediato
historialSistema.push(obtenerMetricasSistema());

module.exports = {
  obtenerMetricasSistema,
  obtenerMetricasMongo,
  historialSistema,
  appCounters,   // exportado para tests / debug
};

const express = require("express");
const cors = require("cors");
const conectarDB = require("./config/db");
const { httpMetricsMiddleware } = require("./middlewares/httpMetricsMiddleware");
// IMPORTANTE: monitoreoService debe requerirse ANTES que cualquier ruta/modelo
// para que el plugin global de Mongoose quede registrado a tiempo
require("./services/monitoreoService");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

// Ruta para el Webhook de Alexa (DEBE IR ANTES de express.json para que Amazon pueda validar la firma)
app.use("/api/alexa", require("./routes/alexaRoutes"));

// 1. PRIMERO le decimos a Express que entienda JSON y CORS
app.use(express.json());
app.use(cors());

// ==========================================
// 2. RASP (Runtime Application Self-Protection)
// ==========================================
const raspProtection = (req, res, next) => {
    // Unimos los datos que envía el usuario (body y url) para analizarlos en tiempo real
    const payload = JSON.stringify(req.body) + JSON.stringify(req.query);
    
    // Lista de firmas de ataques (NoSQL Injection y SQL Injection)
    const maliciousPatterns = /\$gt|\$ne|\$or|\$where|' OR '1'='1/i;

    // El RASP evalúa la memoria en ejecución. Si detecta un ataque, lo bloquea sin apagar el servidor.
    if (maliciousPatterns.test(payload)) {
        console.error("🚨 [RASP DETECTED] Intento de inyección interceptado en tiempo de ejecución.");
        return res.status(403).json({
            seguridad: "RASP ACTIVADO",
            alerta: "Ejecución maliciosa bloqueada. El servidor sigue en línea y protegido."
        });
    }
    next();
};

// 3. Encendemos el RASP para que vigile TODAS las rutas
app.use(raspProtection);

// 4. Middleware de métricas HTTP (registra latencia, errores y contadores)
app.use(httpMetricsMiddleware);

// ==========================================

// limites de recup contra
let recoveryAttempts = {};
// limites para el inicio de sesion 

// JWT
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');

console.log("Private Key:", privateKey);
console.log("Public Key:", publicKey);

const loginAttempts = {};

conectarDB();

app.use("/api/usuarios", (req, res, next) => {
  req.recoveryAttempts = recoveryAttempts;
  req.loginAttempts = loginAttempts;
  req.privateKey = privateKey;
  req.publicKey = publicKey;
  next();
}, require("./routes/userRoutes"));

app.use("/api/faqs", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/faqRoutes"));

app.use("/api/contactos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/contactoRoutes"));

app.use("/api/ubicacion", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/ubicacionRoutes"));

app.use("/api/mision", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/misionRoutes"));

app.use("/api/vision", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/visionRoutes"));

app.use("/api/historia", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/historiaRoutes"));

app.use("/api/politicas", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/politicasRoutes"));

app.use("/api/terminos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/terminosRoutes"));

app.use("/api/metodos-pago", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/metodoPagoRoutes"));

app.use("/api/carruseles", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/carruselRoutes"));

app.use("/api/ofertas", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/ofertaRoutes"));

app.use("/api/metodos-envio", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/metodoEnvioRoutes"));

app.use("/api/marcas", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/marcaRoutes"));

app.use("/api/familias", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/familiaRoutes"));

app.use("/api/productos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/productoRoutes"));

app.use("/api/pedidos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/pedidoRoutes"));

app.use("/api/respaldos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/respaldoRoutes"));

app.use("/api/monitoreo", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/monitoreoRoutes"));

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
const express = require("express");
const cors = require("cors");
const conectarDB = require("./config/db");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 4000;
//limites de recup contra
let recoveryAttempts = {};
//limites para el inicio de sesion 

//JWT
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');

console.log("Private Key:", privateKey);
console.log("Public Key:", publicKey);

const loginAttempts = {};
app.use(express.json());
app.use(cors());
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

app.use("/api/proveedores", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/proveedorRoutes"));

app.use("/api/ofertas", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/ofertaRoutes"));

app.use("/api/metodos-envio", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/metodoEnvioRoutes"));

app.use("/api/categorias", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/categoriaRoutes"));

app.use("/api/productos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/productoRoutes"));

app.use("/api/pedidos", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/pedidoRoutes"));

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
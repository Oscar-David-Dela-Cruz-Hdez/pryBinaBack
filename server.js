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

app.use("/api/info", (req, res, next) => {
  req.publicKey = publicKey;
  next();
}, require("./routes/infoRoutes"));

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

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
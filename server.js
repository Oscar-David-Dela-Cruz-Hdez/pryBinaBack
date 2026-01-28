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

const corsOptions = {
  origin: /* 'http://localhost:4200',  */'https://pry-bina-front.vercel.app/', // Cambia esto al dominio de tu frontend en producción
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
conectarDB();

app.use("/api/usuarios", (req, res, next) => {
  req.recoveryAttempts = recoveryAttempts;
  req.loginAttempts = loginAttempts;
  req.privateKey = privateKey;
  req.publicKey = publicKey;
  next();
}, require("./routes/userRoutes"));

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
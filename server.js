const express = require("express");
const cors = require("cors");
const conectarDB = require("./config/db");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware para parsear JSON y habilitar CORS
app.use(express.json());
app.use(cors());

// Conectar a la base de datos
conectarDB();


app.use("/api/usuarios", require("./routes/userRoutes"));


app.listen(port, () => {
  // Corregí un pequeño error en tu string de consola
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
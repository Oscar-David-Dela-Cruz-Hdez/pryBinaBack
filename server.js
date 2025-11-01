const express = require("express");
const cors = require("cors");
const conectarDB = require("./config/db");
require("dotenv").config();

// Ya no importamos las otras rutas (Terrario, Mision, Vision, etc.)
// ¡MUY IMPORTANTE! Eliminamos la importación del archivo incorrecto 'UsuarioRoutes'

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
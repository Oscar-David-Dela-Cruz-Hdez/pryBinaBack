const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getSistema,
  getMongo,
  getHttp,
  getHistorial,
  getResumen,
} = require("../controllers/monitoreoController");

// Todas las rutas de monitoreo requieren ser administrador
const soloAdmin = authMiddleware(["admin"]);

router.get("/sistema",   soloAdmin, getSistema);
router.get("/mongodb",   soloAdmin, getMongo);
router.get("/http",      soloAdmin, getHttp);
router.get("/historial", soloAdmin, getHistorial);
router.get("/resumen",   soloAdmin, getResumen);

module.exports = router;

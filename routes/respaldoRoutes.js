const express = require('express');
const router = express.Router();
const respaldoController = require('../controllers/respaldoController');

// Ruta para obtener la lista de colecciones disponibles
router.get('/', respaldoController.obtenerColecciones);

// Ruta para generar y descargar el respaldo de la base de datos
// Será de tipo POST para poder recibir el body con "colecciones"
router.post('/generar', respaldoController.generarRespaldo);

module.exports = router;

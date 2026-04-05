const express = require('express');
const router = express.Router();
const {
  getMarcas,
  getMarcaById,
  createMarca,
  updateMarca,
  deleteMarca
} = require('../controllers/marcaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas Públicas
router.get('/', getMarcas);
router.get('/:id', getMarcaById);

// Rutas Privadas (Admin)
router.post('/', authMiddleware(['admin']), createMarca);
router.put('/:id', authMiddleware(['admin']), updateMarca);
router.delete('/:id', authMiddleware(['admin']), deleteMarca);

module.exports = router;

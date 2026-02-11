const express = require('express');
const router = express.Router();
const {
  getCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria
} = require('../controllers/categoriaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas Públicas
router.get('/', getCategorias);
router.get('/:id', getCategoriaById);

// Rutas Privadas (Admin)
// Asumimos que solo admin puede gestionar categorías
router.post('/', authMiddleware(['admin']), createCategoria);
router.put('/:id', authMiddleware(['admin']), updateCategoria);
router.delete('/:id', authMiddleware(['admin']), deleteCategoria);

module.exports = router;

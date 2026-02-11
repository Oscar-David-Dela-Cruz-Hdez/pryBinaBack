const express = require('express');
const router = express.Router();
const {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto
} = require('../controllers/productoController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas Públicas
router.get('/', getProductos);
router.get('/:id', getProductoById);

// Rutas Privadas (Admin)
router.post('/', authMiddleware(['admin']), createProducto);
router.put('/:id', authMiddleware(['admin']), updateProducto);
router.delete('/:id', authMiddleware(['admin']), deleteProducto);

module.exports = router;

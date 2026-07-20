const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
  exportarProductosExcel,
  importarProductosExcel
  ,getRecomendaciones
} = require('../controllers/productoController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas Públicas
router.get('/', getProductos);
router.post('/recomendaciones', getRecomendaciones);
router.get('/:id/recomendaciones', getRecomendaciones);
router.get('/:id', getProductoById);

// Rutas Privadas (Admin)
router.get('/exportar/excel', authMiddleware(['admin']), exportarProductosExcel);
router.post('/importar/excel', authMiddleware(['admin']), upload.single('archivo'), importarProductosExcel);

router.post('/', authMiddleware(['admin']), createProducto);
router.put('/:id', authMiddleware(['admin']), updateProducto);
router.delete('/:id', authMiddleware(['admin']), deleteProducto);

module.exports = router;

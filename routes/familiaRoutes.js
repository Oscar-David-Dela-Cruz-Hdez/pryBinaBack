const express = require('express');
const router = express.Router();
const {
  getFamilias,
  getFamiliaById,
  createFamilia,
  updateFamilia,
  deleteFamilia
} = require('../controllers/familiaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas Públicas
router.get('/', getFamilias);
router.get('/:id', getFamiliaById);

// Rutas Privadas (Admin)
router.post('/', authMiddleware(['admin']), createFamilia);
router.put('/:id', authMiddleware(['admin']), updateFamilia);
router.delete('/:id', authMiddleware(['admin']), deleteFamilia);

module.exports = router;

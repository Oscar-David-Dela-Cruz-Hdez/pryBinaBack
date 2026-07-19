const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  crearOrdenPaypal,
  capturarOrdenPaypal,
  reintentarOrdenPaypal,
  cancelarPedidoPaypal,
  obtenerConfiguracionPaypal
} = require("../controllers/pagoController");

const router = express.Router();

router.get("/paypal/config", obtenerConfiguracionPaypal);
router.post("/paypal/orden", authMiddleware(), crearOrdenPaypal);
router.post("/paypal/pedido/:pedidoId/orden", authMiddleware(), reintentarOrdenPaypal);
router.post("/paypal/pedido/:pedidoId/cancelar", authMiddleware(), cancelarPedidoPaypal);
router.post("/paypal/orden/:orderId/capturar", authMiddleware(), capturarOrdenPaypal);

module.exports = router;

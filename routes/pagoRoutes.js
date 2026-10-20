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

// Estas páginas no capturan pagos: la app confirma con el endpoint autenticado.
router.get("/paypal/retorno", (_req, res) => res.type("html").send(
  '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PayPal</title><h1>Autorización recibida</h1><p>Regresa a Panamericana y pulsa Confirmar pago para completar tu pedido.</p></html>'
));
router.get("/paypal/cancelado", (_req, res) => res.type("html").send(
  '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PayPal</title><h1>Pago sin completar</h1><p>Regresa a Panamericana para reintentar o cancelar tu pedido.</p></html>'
));
router.get("/paypal/config", obtenerConfiguracionPaypal);
router.post("/paypal/orden", authMiddleware(), crearOrdenPaypal);
router.post("/paypal/pedido/:pedidoId/orden", authMiddleware(), reintentarOrdenPaypal);
router.post("/paypal/pedido/:pedidoId/cancelar", authMiddleware(), cancelarPedidoPaypal);
router.post("/paypal/orden/:orderId/capturar", authMiddleware(), capturarOrdenPaypal);

module.exports = router;

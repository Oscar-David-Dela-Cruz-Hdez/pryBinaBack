const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  crearOrdenPaypal,
  capturarOrdenPaypal,
  obtenerConfiguracionPaypal
} = require("../controllers/pagoController");

const router = express.Router();

router.get("/paypal/config", obtenerConfiguracionPaypal);
router.post("/paypal/orden", authMiddleware(), crearOrdenPaypal);
router.post("/paypal/orden/:orderId/capturar", authMiddleware(), capturarOrdenPaypal);

module.exports = router;

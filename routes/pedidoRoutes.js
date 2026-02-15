const express = require("express");
const {
    createPedido,
    getPedidos,
    getPedidoById,
    updateEstadoPedido
} = require("../controllers/pedidoController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Rutas protegidas (Requieren Login)
router.post("/", authMiddleware(), createPedido);
router.get("/", authMiddleware(), getPedidos); // Admin ve todo, User solo suyos
router.get("/:id", authMiddleware(), getPedidoById);

// Rutas Admin
router.put("/:id/estado", authMiddleware(["admin"]), updateEstadoPedido);

module.exports = router;

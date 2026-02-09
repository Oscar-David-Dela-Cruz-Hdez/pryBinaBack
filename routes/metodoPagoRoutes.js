const express = require("express");
const { 
    getMetodosPago, 
    getMetodoPagoById, 
    createMetodoPago, 
    updateMetodoPago, 
    deleteMetodoPago 
} = require("../controllers/metodoPagoController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- PÚBLICO ---
// Listar todos. Se puede usar ?activo=true para filtrar solo los disponibles
router.get("/", getMetodosPago);
router.get("/:id", getMetodoPagoById);

// --- ADMIN (PROTEGIDO) ---
router.post("/", authMiddleware(["admin"]), createMetodoPago);
router.put("/:id", authMiddleware(["admin"]), updateMetodoPago);
router.delete("/:id", authMiddleware(["admin"]), deleteMetodoPago);

module.exports = router;

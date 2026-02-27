const express = require("express");
const { 
    getOfertas, 
    getOfertaById, 
    createOferta, 
    updateOferta, 
    deleteOferta 
} = require("../controllers/ofertaController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- RUTAS OPORTUNAS ---
router.get("/", getOfertas);
router.get("/:id", getOfertaById);

// --- ADMIN (PROTEGIDO) ---
router.post("/", authMiddleware(["admin"]), createOferta);
router.put("/:id", authMiddleware(["admin"]), updateOferta);
router.delete("/:id", authMiddleware(["admin"]), deleteOferta);

module.exports = router;

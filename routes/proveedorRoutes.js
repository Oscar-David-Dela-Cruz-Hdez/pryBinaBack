const express = require("express");
const { 
    getProveedores, 
    getProveedorById, 
    createProveedor, 
    updateProveedor, 
    deleteProveedor 
} = require("../controllers/proveedorController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- PÚBLICO (o restringir si es info interna) ---
// Dejamos GET público por si quieres mostrar "Nuestros Aliados" en el front.
// Si prefieres que sea solo admin, agrega el middleware.
router.get("/", getProveedores);
router.get("/:id", getProveedorById);

// --- ADMIN (PROTEGIDO) ---
router.post("/", authMiddleware(["admin"]), createProveedor);
router.put("/:id", authMiddleware(["admin"]), updateProveedor);
router.delete("/:id", authMiddleware(["admin"]), deleteProveedor);

module.exports = router;

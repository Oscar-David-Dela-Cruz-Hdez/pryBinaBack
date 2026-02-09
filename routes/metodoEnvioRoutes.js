const express = require("express");
const { 
    getMetodosEnvio, 
    getMetodoEnvioById, 
    createMetodoEnvio, 
    updateMetodoEnvio, 
    deleteMetodoEnvio 
} = require("../controllers/metodoEnvioController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- PÚBLICO ---
// Listar todos. ?activo=true para filtrar.
router.get("/", getMetodosEnvio);
router.get("/:id", getMetodoEnvioById);

// --- ADMIN (PROTEGIDO) ---
router.post("/", authMiddleware(["admin"]), createMetodoEnvio);
router.put("/:id", authMiddleware(["admin"]), updateMetodoEnvio);
router.delete("/:id", authMiddleware(["admin"]), deleteMetodoEnvio);

module.exports = router;

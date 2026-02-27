const express = require("express");
const { 
    getCarrusels, 
    getCarruselById, 
    createCarrusel, 
    updateCarrusel, 
    deleteCarrusel 
} = require("../controllers/carruselController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- PÚBLICO ---
// Listar todas. ?activo=true para filtrar.
router.get("/", getCarrusels);
router.get("/:id", getCarruselById);

// --- ADMIN (PROTEGIDO) ---
router.post("/", authMiddleware(["admin"]), createCarrusel);
router.put("/:id", authMiddleware(["admin"]), updateCarrusel);
router.delete("/:id", authMiddleware(["admin"]), deleteCarrusel);

module.exports = router;

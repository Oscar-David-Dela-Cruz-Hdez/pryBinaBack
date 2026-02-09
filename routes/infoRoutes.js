const express = require("express");
const { 
    getInformacion, 
    updateInformacion, 
    deleteInformacion,
    addFaq, deleteFaq,
    addContacto, deleteContacto 
} = require("../controllers/informacionController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- PÚBLICO ---
router.get("/", getInformacion);

// --- ADMIN (PROTEGIDO) ---

// Actualización general (Misión, Visión, Ubicación, Políticas)
// Se puede enviar solo el campo que se desea cambiar.
router.put("/", authMiddleware(["admin"]), updateInformacion);

// Gestión independiente de Preguntas Frecuentes
router.post("/faq", authMiddleware(["admin"]), addFaq);
router.delete("/faq/:id", authMiddleware(["admin"]), deleteFaq);

// Gestión independiente de Contactos
router.post("/contacto", authMiddleware(["admin"]), addContacto);
router.delete("/contacto/:id", authMiddleware(["admin"]), deleteContacto);

// Eliminar TODA la información
router.delete("/", authMiddleware(["admin"]), deleteInformacion);

module.exports = router;

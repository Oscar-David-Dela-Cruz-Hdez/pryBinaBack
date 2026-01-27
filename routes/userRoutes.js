const express = require("express");
const {
  registerUser,
  loginUser,
  verifyLoginCode,
  googleLogin,
  getUsuarios,
  updateRol,
  deleteUsuario,
  verificarCorreo,
  obtenerPregunta,
  verificarRespuesta,
  cambiarContrasena,
  getMiPerfil,
  updateMiPerfil,
  updatePassword,
  updateSecret,
  checkUsername,
  checkEmail,
  checkPhone,
} = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// --- Rutas Públicas ---
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-2fa", verifyLoginCode);
router.post("/google-login", googleLogin);
router.post("/verificar-correo", verificarCorreo);
router.post("/obtener-pregunta", obtenerPregunta);
router.post("/verificar-respuesta", verificarRespuesta);
router.post("/cambiar-contrasena", cambiarContrasena);
router.post("/check-username", checkUsername);
router.post("/check-email", checkEmail);
router.post("/check-phone", checkPhone);


// --- Rutas Privadas (requieren token) ---
router.get("/perfil", authMiddleware(), getMiPerfil);
router.put("/perfil", authMiddleware(), updateMiPerfil);
router.put("/update-password", authMiddleware(), updatePassword);
router.put("/update-secret", authMiddleware(), updateSecret);

// --- Rutas de Administrador (requieren rol 'admin') ---
router.get("/admin/usuarios", authMiddleware(["admin"]), getUsuarios);
router.put("/admin/usuarios/:id/rol", authMiddleware(["admin"]), updateRol);
router.delete("/admin/usuarios/:id", authMiddleware(["admin"]), deleteUsuario);

module.exports = router;
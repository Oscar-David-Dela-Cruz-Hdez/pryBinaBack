const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return res.status(401).json({ error: "Acceso denegado. No hay token proporcionado." });
    }

    // Extraer solo el token, sin el prefijo "Bearer "
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Acceso denegado. Token no válido." });
    }

    try {
      console.log("Token recibido:", token); // Log para depuración
      console.log("Clave pública:", req.publicKey); // Log para depuración

      const decoded = jwt.verify(token, req.publicKey, { algorithms: ['RS256'] });
      console.log("Token decodificado:", decoded); // Log para depuración

      const usuario = await Usuario.findById(decoded.id);
      if (!usuario) {
        return res.status(401).json({ error: "Acceso denegado. Usuario no encontrado." });
      }

      if (!usuario.activeTokens.includes(token)) {
        return res.status(401).json({ error: "Acceso denegado. Token inválido." });
      }

      req.user = decoded;
      if (roles.length > 0 && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: "Acceso denegado. No tienes permisos suficientes." });
      }

      next();
    } catch (error) {
      console.error("Error en authMiddleware:", error);
      res.status(400).json({ error: "Token inválido." });
    }
  };
};

module.exports = authMiddleware;

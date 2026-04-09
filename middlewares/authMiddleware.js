const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) {
      return res.status(401).json({ error: "Acceso denegado. No hay token proporcionado." });
    }
    try {
      const decoded = jwt.verify(token, req.publicKey, { algorithms: ['RS256'] });
      
      const usuario = await Usuario.findById(decoded.id);
      if (!usuario) {
        return res.status(401).json({ error: "Acceso denegado. Usuario no encontrado." });
      }

      if (!usuario.activeTokens?.includes(token)) {
        return res.status(401).json({ error: "Acceso denegado. Token inválido o sesión cerrada." });
      }

      req.user = decoded;
      
      if (roles.length > 0 && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: "Acceso denegado. No tienes permisos suficientes." });
      }
      
      next();
    } catch (error) {
      console.error("Error en authMiddleware:", error.message);
      // Retornamos 401 en lugar de 400 para que el frontend sepa que debe cerrar sesión
      res.status(401).json({ error: "Token inválido o expirado." });
    }
  };
};

module.exports = authMiddleware;
//funciona
/* const jwt = require("jsonwebtoken");

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ error: "Acceso denegado. No hay token proporcionado." });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.user = decoded;

      if (roles.length > 0 && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: "Acceso denegado. No tienes permisos suficientes." });
      }

      next();
    } catch (error) {
      res.status(400).json({ error: "Token inválido." });
    }
  };
};

module.exports = authMiddleware; */

//nuevo, experimental
const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

//codigo 1 sirve
/* const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) {
      return res.status(401).json({ error: "Acceso denegado. No hay token proporcionado." });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      const usuario = await Usuario.findById(decoded.id);

      if (!usuario) {
        return res.status(401).json({ error: "Acceso denegado. Usuario no encontrado." });
      }

      // Verificar si el token está en el array de tokens activos
      if (!usuario.activeTokens.includes(token)) {
        return res.status(401).json({ error: "Acceso denegado. Token inválido." });
      }

      req.user = decoded;
      if (roles.length > 0 && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: "Acceso denegado. No tienes permisos suficientes." });
      }
      next();
    } catch (error) {
      res.status(400).json({ error: "Token inválido." });
    }
  };
}; */

//codigo 2, experimental
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
const Ubicacion = require("../models/Ubicacion");
const filterXSS = require('xss');

// Obtener Ubicación (Singleton)
const getUbicacion = async (req, res) => {
    try {
        let ubicacion = await Ubicacion.findOne();
        if (!ubicacion) {
            // Si no existe, devolvemos objeto vacío o creamos uno por defecto (lazy init)
            ubicacion = new Ubicacion();
            await ubicacion.save();
        }
        res.json(ubicacion);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener ubicación" });
    }
};

// Actualizar Ubicación (Upsert)
const updateUbicacion = async (req, res) => {
    try {
        const { direccion, latitud, longitud, googleMapsUrl, telefono, horario } = req.body;

        let ubicacion = await Ubicacion.findOne();
        if (!ubicacion) ubicacion = new Ubicacion();

        if (direccion !== undefined) ubicacion.direccion = filterXSS(direccion);
        if (latitud !== undefined) ubicacion.latitud = latitud;
        if (longitud !== undefined) ubicacion.longitud = longitud;
        if (googleMapsUrl !== undefined) ubicacion.googleMapsUrl = filterXSS(googleMapsUrl);
        if (telefono !== undefined) ubicacion.telefono = filterXSS(telefono);
        if (horario !== undefined) ubicacion.horario = filterXSS(horario);

        await ubicacion.save();
        res.json(ubicacion);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar ubicación" });
    }
};

module.exports = { getUbicacion, updateUbicacion };

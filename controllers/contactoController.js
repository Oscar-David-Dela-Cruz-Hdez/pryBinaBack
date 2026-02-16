const Contacto = require("../models/Contacto");
const filterXSS = require('xss');

// Obtener Contactos
const getContactos = async (req, res) => {
    try {
        const { activo } = req.query;
        let query = {};
        if (activo === 'true') query.activo = true;

        const contactos = await Contacto.find(query);
        res.json(contactos);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener contactos" });
    }
};

// Crear Contacto
const createContacto = async (req, res) => {
    try {
        const { tipo, valor, icono, activo } = req.body;
        if (!tipo || !valor) return res.status(400).json({ error: "Tipo y Valor son requeridos" });

        const nuevoContacto = new Contacto({
            tipo: filterXSS(tipo),
            valor: filterXSS(valor),
            icono: filterXSS(icono || ""),
            activo: activo !== undefined ? activo : true
        });

        await nuevoContacto.save();
        res.status(201).json(nuevoContacto);
    } catch (error) {
        res.status(500).json({ error: "Error al crear contacto" });
    }
};

// Actualizar Contacto
const updateContacto = async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;

        if (datos.tipo) datos.tipo = filterXSS(datos.tipo);
        if (datos.valor) datos.valor = filterXSS(datos.valor);
        if (datos.icono) datos.icono = filterXSS(datos.icono);

        const contacto = await Contacto.findByIdAndUpdate(id, datos, { new: true });
        if (!contacto) return res.status(404).json({ error: "Contacto no encontrado" });

        res.json(contacto);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar contacto" });
    }
};

// Eliminar Contacto
const deleteContacto = async (req, res) => {
    try {
        const { id } = req.params;
        await Contacto.findByIdAndDelete(id);
        res.json({ mensaje: "Contacto eliminado" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar contacto" });
    }
};

module.exports = { getContactos, createContacto, updateContacto, deleteContacto };

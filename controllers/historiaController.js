const Historia = require("../models/Historia");
const filterXSS = require('xss');

const getHistoria = async (req, res) => {
    try {
        let doc = await Historia.findOne();
        if (!doc) { doc = new Historia(); await doc.save(); }
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al obtener Historia" }); }
};

const updateHistoria = async (req, res) => {
    try {
        const { texto } = req.body;
        let doc = await Historia.findOne();
        if (!doc) doc = new Historia();
        if (texto !== undefined) doc.texto = filterXSS(texto);
        await doc.save();
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al actualizar Historia" }); }
};

module.exports = { getHistoria, updateHistoria };

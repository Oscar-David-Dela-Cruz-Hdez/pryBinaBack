const Terminos = require("../models/Terminos");
const filterXSS = require('xss');

const getTerminos = async (req, res) => {
    try {
        let doc = await Terminos.findOne();
        if (!doc) { doc = new Terminos(); await doc.save(); }
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al obtener Términos" }); }
};

const updateTerminos = async (req, res) => {
    try {
        const { texto } = req.body;
        let doc = await Terminos.findOne();
        if (!doc) doc = new Terminos();
        if (texto !== undefined) doc.texto = filterXSS(texto);
        await doc.save();
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al actualizar Términos" }); }
};

module.exports = { getTerminos, updateTerminos };

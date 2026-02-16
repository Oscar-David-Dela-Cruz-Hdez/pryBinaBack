const Mision = require("../models/Mision");
const filterXSS = require('xss');

const getMision = async (req, res) => {
    try {
        let doc = await Mision.findOne();
        if (!doc) { doc = new Mision(); await doc.save(); }
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al obtener Misión" }); }
};

const updateMision = async (req, res) => {
    try {
        const { texto } = req.body;
        let doc = await Mision.findOne();
        if (!doc) doc = new Mision();
        if (texto !== undefined) doc.texto = filterXSS(texto);
        await doc.save();
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al actualizar Misión" }); }
};

module.exports = { getMision, updateMision };

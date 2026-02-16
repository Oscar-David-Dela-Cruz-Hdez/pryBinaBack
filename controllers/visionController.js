const Vision = require("../models/Vision");
const filterXSS = require('xss');

const getVision = async (req, res) => {
    try {
        let doc = await Vision.findOne();
        if (!doc) { doc = new Vision(); await doc.save(); }
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al obtener Visión" }); }
};

const updateVision = async (req, res) => {
    try {
        const { texto } = req.body;
        let doc = await Vision.findOne();
        if (!doc) doc = new Vision();
        if (texto !== undefined) doc.texto = filterXSS(texto);
        await doc.save();
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al actualizar Visión" }); }
};

module.exports = { getVision, updateVision };

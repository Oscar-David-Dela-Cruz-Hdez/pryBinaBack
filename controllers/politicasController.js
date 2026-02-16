const Politicas = require("../models/Politicas");
const filterXSS = require('xss');

const getPoliticas = async (req, res) => {
    try {
        let doc = await Politicas.findOne();
        if (!doc) { doc = new Politicas(); await doc.save(); }
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al obtener Políticas" }); }
};

const updatePoliticas = async (req, res) => {
    try {
        const { texto } = req.body;
        let doc = await Politicas.findOne();
        if (!doc) doc = new Politicas();
        if (texto !== undefined) doc.texto = filterXSS(texto);
        await doc.save();
        res.json(doc);
    } catch (e) { res.status(500).json({ error: "Error al actualizar Políticas" }); }
};

module.exports = { getPoliticas, updatePoliticas };

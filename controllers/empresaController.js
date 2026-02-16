const Empresa = require("../models/Empresa");
const filterXSS = require('xss');

// Obtener Info Empresa (Singleton)
const getEmpresa = async (req, res) => {
    try {
        let empresa = await Empresa.findOne();
        if (!empresa) {
            empresa = new Empresa();
            await empresa.save();
        }
        res.json(empresa);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener datos de empresa" });
    }
};

// Actualizar Info Empresa (Upsert)
const updateEmpresa = async (req, res) => {
    try {
        const { mision, vision, historia, politicasPrivacidad, terminosServicio } = req.body;

        let empresa = await Empresa.findOne();
        if (!empresa) empresa = new Empresa();

        if (mision !== undefined) empresa.mision = filterXSS(mision);
        if (vision !== undefined) empresa.vision = filterXSS(vision);
        if (historia !== undefined) empresa.historia = filterXSS(historia);
        if (politicasPrivacidad !== undefined) empresa.politicasPrivacidad = filterXSS(politicasPrivacidad);
        if (terminosServicio !== undefined) empresa.terminosServicio = filterXSS(terminosServicio);

        await empresa.save();
        res.json(empresa);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar datos de empresa" });
    }
};

module.exports = { getEmpresa, updateEmpresa };

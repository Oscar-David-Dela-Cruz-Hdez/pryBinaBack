const Faq = require("../models/Faq");
const filterXSS = require('xss');

// Obtener todas las FAQs
const getFaqs = async (req, res) => {
    try {
        const { activo } = req.query;
        let query = {};
        if (activo === 'true') query.activo = true;

        const faqs = await Faq.find(query).sort({ orden: 1, createdAt: -1 });
        res.json(faqs);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener FAQs" });
    }
};

// Crear FAQ
const createFaq = async (req, res) => {
    try {
        const { pregunta, respuesta, activo, orden } = req.body;
        if (!pregunta || !respuesta) return res.status(400).json({ error: "Datos incompletos" });

        const nuevaFaq = new Faq({
            pregunta: filterXSS(pregunta),
            respuesta: filterXSS(respuesta),
            activo: activo !== undefined ? activo : true,
            orden: orden || 0
        });

        await nuevaFaq.save();
        res.status(201).json(nuevaFaq);
    } catch (error) {
        res.status(500).json({ error: "Error al crear FAQ" });
    }
};

// Actualizar FAQ
const updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;

        if (datos.pregunta) datos.pregunta = filterXSS(datos.pregunta);
        if (datos.respuesta) datos.respuesta = filterXSS(datos.respuesta);

        const faq = await Faq.findByIdAndUpdate(id, datos, { new: true });
        if (!faq) return res.status(404).json({ error: "FAQ no encontrada" });

        res.json(faq);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar FAQ" });
    }
};

// Eliminar FAQ
const deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        await Faq.findByIdAndDelete(id);
        res.json({ mensaje: "FAQ eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar FAQ" });
    }
};

module.exports = { getFaqs, createFaq, updateFaq, deleteFaq };

const Informacion = require("../models/Informacion");
const filterXSS = require('xss');

const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  if (typeof dato === 'string') {
      const strDato = String(dato).trim();
      // Permitimos vacíos si el usuario quiere borrar el contenido
      return filterXSS(strDato);
  }
  return dato; 
};

// Obtener la información del sitio (público)
const getInformacion = async (req, res) => {
  try {
    let info = await Informacion.findOne();
    if (!info) return res.json({});
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la información" });
  }
};

// Actualización General INTELIGENTE (Patch)
// Permite actualizar solo lo que se envía (misión, visión, etc.) sin borrar lo demás
const updateInformacion = async (req, res) => {
  try {
    const { 
      mision, vision, ubicacion, politicasPrivacidad, terminosServicio 
    } = req.body;

    let info = await Informacion.findOne();
    if (!info) info = new Informacion();

    // Solo actualizamos campos si vienen definidos en el body
    if (mision !== undefined) info.mision = limpiarDato(mision);
    if (vision !== undefined) info.vision = limpiarDato(vision);
    if (politicasPrivacidad !== undefined) info.politicasPrivacidad = limpiarDato(politicasPrivacidad);
    if (terminosServicio !== undefined) info.terminosServicio = limpiarDato(terminosServicio);
    
    // Ubicación es un objeto, requiere cuidado para no borrar lat/lng si solo mandan direccion
    if (ubicacion) {
        if (!info.ubicacion) info.ubicacion = {};
        if (ubicacion.direccion !== undefined) info.ubicacion.direccion = limpiarDato(ubicacion.direccion);
        if (ubicacion.latitud !== undefined) info.ubicacion.latitud = ubicacion.latitud;
        if (ubicacion.longitud !== undefined) info.ubicacion.longitud = ubicacion.longitud;
        if (ubicacion.googleMapsUrl !== undefined) info.ubicacion.googleMapsUrl = filterXSS(ubicacion.googleMapsUrl);
    }

    await info.save();
    res.json({ mensaje: "Información actualizada", info });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar" });
  }
};

// --- GESTIÓN DE FAQs (Preguntas Frecuentes) ---

// Agregar una FAQ
const addFaq = async (req, res) => {
    try {
        const { pregunta, respuesta } = req.body;
        if (!pregunta || !respuesta) return res.status(400).json({ error: "Pregunta y respuesta requeridas" });

        let info = await Informacion.findOne();
        if (!info) info = new Informacion();

        info.preguntasFrecuentes.push({ pregunta, respuesta });
        await info.save();
        res.json({ mensaje: "Pregunta agregada", faqs: info.preguntasFrecuentes });
    } catch (error) {
        res.status(500).json({ error: "Error al agregar FAQ" });
    }
};

// Eliminar una FAQ
const deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        let info = await Informacion.findOne();
        if (!info) return res.status(404).json({ error: "Información no encontrada" });

        info.preguntasFrecuentes = info.preguntasFrecuentes.filter(faq => faq._id.toString() !== id);
        await info.save();
        res.json({ mensaje: "Pregunta eliminada", faqs: info.preguntasFrecuentes });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar FAQ" });
    }
};

// --- GESTIÓN DE CONTACTOS ---

// Agregar Contacto
const addContacto = async (req, res) => {
    try {
        const { tipo, valor, icono } = req.body;
        if (!tipo || !valor) return res.status(400).json({ error: "Tipo y valor requeridos" });

        let info = await Informacion.findOne();
        if (!info) info = new Informacion();

        info.contactos.push({ tipo, valor, icono });
        await info.save();
        res.json({ mensaje: "Contacto agregado", contactos: info.contactos });
    } catch (error) {
        res.status(500).json({ error: "Error al agregar contacto" });
    }
};

// Eliminar Contacto
const deleteContacto = async (req, res) => {
    try {
        const { id } = req.params;
        let info = await Informacion.findOne();
        if (!info) return res.status(404).json({ error: "Información no encontrada" });

        info.contactos = info.contactos.filter(c => c._id.toString() !== id);
        await info.save();
        res.json({ mensaje: "Contacto eliminado", contactos: info.contactos });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar contacto" });
    }
};

// Eliminar la información completa (reset)
const deleteInformacion = async (req, res) => {
  try {
    await Informacion.deleteMany({});
    res.json({ mensaje: "Toda la información ha sido eliminada" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar la información" });
  }
};

module.exports = {
  getInformacion,
  updateInformacion,
  deleteInformacion,
  addFaq, deleteFaq,
  addContacto, deleteContacto
};

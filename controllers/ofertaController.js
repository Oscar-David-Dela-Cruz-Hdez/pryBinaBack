const Oferta = require("../models/Oferta");
const filterXSS = require('xss');

const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  if (typeof dato === 'string') {
      const strDato = String(dato).trim();
      return filterXSS(strDato);
  }
  return dato; 
};

// Obtener todas las ofertas (Público)
// Se devuelven ordenadas por el campo 'orden' ascendente
const getOfertas = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = {};
    if (activo === 'true') {
        query.activo = true;
    }
    // Sort: orden ascendente, luego por fecha de creación descendente
    const ofertas = await Oferta.find(query).sort({ orden: 1, createdAt: -1 });
    res.json(ofertas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ofertas" });
  }
};

// Obtener una oferta por ID
const getOfertaById = async (req, res) => {
    try {
        const { id } = req.params;
        const oferta = await Oferta.findById(id);
        if (!oferta) return res.status(404).json({ error: "Oferta no encontrada" });
        res.json(oferta);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener oferta" });
    }
};

// Crear Oferta (Admin)
const createOferta = async (req, res) => {
  try {
    const { titulo, imagenUrl, enlaceDestino, orden, activo } = req.body;
    
    if (!imagenUrl) return res.status(400).json({ error: "La URL de la imagen es obligatoria" });

    const nuevaOferta = new Oferta({
        titulo: limpiarDato(titulo),
        imagenUrl: limpiarDato(imagenUrl), // Asumimos URL externa o gestionada por otro servicio de subida
        enlaceDestino: limpiarDato(enlaceDestino),
        orden: orden !== undefined ? orden : 0,
        activo: activo !== undefined ? activo : true
    });

    await nuevaOferta.save();
    res.status(201).json({ mensaje: "Oferta creada", oferta: nuevaOferta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear oferta" });
  }
};

// Actualizar Oferta (Admin)
const updateOferta = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, imagenUrl, enlaceDestino, orden, activo } = req.body;

    const datosActualizar = {};
    if (titulo !== undefined) datosActualizar.titulo = limpiarDato(titulo);
    if (imagenUrl !== undefined) datosActualizar.imagenUrl = limpiarDato(imagenUrl);
    if (enlaceDestino !== undefined) datosActualizar.enlaceDestino = limpiarDato(enlaceDestino);
    if (orden !== undefined) datosActualizar.orden = orden;
    if (activo !== undefined) datosActualizar.activo = activo;

    const ofertaActualizada = await Oferta.findByIdAndUpdate(id, datosActualizar, { new: true });
    
    if (!ofertaActualizada) return res.status(404).json({ error: "Oferta no encontrada" });

    res.json({ mensaje: "Oferta actualizada", oferta: ofertaActualizada });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar oferta" });
  }
};

// Eliminar Oferta (Admin)
const deleteOferta = async (req, res) => {
  try {
    const { id } = req.params;
    const ofertaEliminada = await Oferta.findByIdAndDelete(id);
    
    if (!ofertaEliminada) return res.status(404).json({ error: "Oferta no encontrada" });

    res.json({ mensaje: "Oferta eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar oferta" });
  }
};

module.exports = {
  getOfertas,
  getOfertaById,
  createOferta,
  updateOferta,
  deleteOferta
};

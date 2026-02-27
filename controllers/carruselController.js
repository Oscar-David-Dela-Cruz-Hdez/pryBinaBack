const Carrusel = require("../models/Carrusel");
const filterXSS = require('xss');

const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  if (typeof dato === 'string') {
      const strDato = String(dato).trim();
      return filterXSS(strDato);
  }
  return dato; 
};

// Obtener todas las Carrusels (Público)
// Se devuelven ordenadas por el campo 'orden' ascendente
const getCarrusels = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = {};
    if (activo === 'true') {
        query.activo = true;
    }
    // Sort: orden ascendente, luego por fecha de creación descendente
    const Carrusels = await Carrusel.find(query).sort({ orden: 1, createdAt: -1 });
    res.json(Carrusels);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener Carrusels" });
  }
};

// Obtener una Carrusel por ID
const getCarruselById = async (req, res) => {
    try {
        const { id } = req.params;
        const Carrusel = await Carrusel.findById(id);
        if (!Carrusel) return res.status(404).json({ error: "Carrusel no encontrada" });
        res.json(Carrusel);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener Carrusel" });
    }
};

// Crear Carrusel (Admin)
const createCarrusel = async (req, res) => {
  try {
    const { titulo, imagenUrl, enlaceDestino, orden, activo } = req.body;
    
    if (!imagenUrl) return res.status(400).json({ error: "La URL de la imagen es obligatoria" });

    const nuevaCarrusel = new Carrusel({
        titulo: limpiarDato(titulo),
        imagenUrl: limpiarDato(imagenUrl), // Asumimos URL externa o gestionada por otro servicio de subida
        enlaceDestino: limpiarDato(enlaceDestino),
        orden: orden !== undefined ? orden : 0,
        activo: activo !== undefined ? activo : true
    });

    await nuevaCarrusel.save();
    res.status(201).json({ mensaje: "Carrusel creada", Carrusel: nuevaCarrusel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear Carrusel" });
  }
};

// Actualizar Carrusel (Admin)
const updateCarrusel = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, imagenUrl, enlaceDestino, orden, activo } = req.body;

    const datosActualizar = {};
    if (titulo !== undefined) datosActualizar.titulo = limpiarDato(titulo);
    if (imagenUrl !== undefined) datosActualizar.imagenUrl = limpiarDato(imagenUrl);
    if (enlaceDestino !== undefined) datosActualizar.enlaceDestino = limpiarDato(enlaceDestino);
    if (orden !== undefined) datosActualizar.orden = orden;
    if (activo !== undefined) datosActualizar.activo = activo;

    const CarruselActualizada = await Carrusel.findByIdAndUpdate(id, datosActualizar, { new: true });
    
    if (!CarruselActualizada) return res.status(404).json({ error: "Carrusel no encontrada" });

    res.json({ mensaje: "Carrusel actualizada", Carrusel: CarruselActualizada });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar Carrusel" });
  }
};

// Eliminar Carrusel (Admin)
const deleteCarrusel = async (req, res) => {
  try {
    const { id } = req.params;
    const CarruselEliminada = await Carrusel.findByIdAndDelete(id);
    
    if (!CarruselEliminada) return res.status(404).json({ error: "Carrusel no encontrada" });

    res.json({ mensaje: "Carrusel eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar Carrusel" });
  }
};

module.exports = {
  getCarrusels,
  getCarruselById,
  createCarrusel,
  updateCarrusel,
  deleteCarrusel
};

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

// Obtener todos los carruseles (Público)
// Se devuelven ordenadas por el campo 'orden' ascendente
const getCarrusels = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = {};
    if (activo === 'true') {
        query.activo = true;
    }
    // Sort: orden ascendente, luego por fecha de creación descendente
    const carruseles = await Carrusel.find(query).sort({ orden: 1, createdAt: -1 });
    res.json(carruseles);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener carruseles" });
  }
};

// Obtener un carrusel por ID
const getCarruselById = async (req, res) => {
    try {
        const { id } = req.params;
        const carrusel = await Carrusel.findById(id);
        if (!carrusel) return res.status(404).json({ error: "Carrusel no encontrado" });
        res.json(carrusel);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener carrusel" });
    }
};

// Crear Carrusel (Admin)
const createCarrusel = async (req, res) => {
  try {
    const { titulo, imagenUrl, enlaceDestino, orden, activo } = req.body;
    
    if (!imagenUrl) return res.status(400).json({ error: "La URL de la imagen es obligatoria" });

    const nuevoCarrusel = new Carrusel({
        titulo: limpiarDato(titulo),
        imagenUrl: limpiarDato(imagenUrl), // Asumimos URL externa o gestionada por otro servicio de subida
        enlaceDestino: limpiarDato(enlaceDestino),
        orden: orden !== undefined ? orden : 0,
        activo: activo !== undefined ? activo : true
    });

    await nuevoCarrusel.save();
    res.status(201).json({ mensaje: "Carrusel creado", carrusel: nuevoCarrusel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear carrusel" });
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

    const carruselActualizado = await Carrusel.findByIdAndUpdate(id, datosActualizar, { new: true });
    
    if (!carruselActualizado) return res.status(404).json({ error: "Carrusel no encontrado" });

    res.json({ mensaje: "Carrusel actualizado", carrusel: carruselActualizado });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar carrusel" });
  }
};

// Eliminar Carrusel (Admin)
const deleteCarrusel = async (req, res) => {
  try {
    const { id } = req.params;
    const carruselEliminado = await Carrusel.findByIdAndDelete(id);
    
    if (!carruselEliminado) return res.status(404).json({ error: "Carrusel no encontrado" });

    res.json({ mensaje: "Carrusel eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar carrusel" });
  }
};

module.exports = {
  getCarrusels,
  getCarruselById,
  createCarrusel,
  updateCarrusel,
  deleteCarrusel
};

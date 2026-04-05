const Familia = require('../models/Familia');

// Obtener todas las familias
const getFamilias = async (req, res) => {
  try {
    const { marca } = req.query;
    let query = {};
    if (marca) {
      query.marca = marca;
    }
    const familias = await Familia.find(query).populate('marca', 'nombre');
    res.json(familias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener familias" });
  }
};

// Obtener una familia por ID
const getFamiliaById = async (req, res) => {
  try {
    const { id } = req.params;
    const familia = await Familia.findById(id).populate('marca', 'nombre');
    if (!familia) {
      return res.status(404).json({ error: "Familia no encontrada" });
    }
    res.json(familia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener la familia" });
  }
};

// Crear una nueva familia
const createFamilia = async (req, res) => {
  try {
    const { nombre, descripcion, marca } = req.body;
    
    if (!nombre || !marca) {
      return res.status(400).json({ error: "El nombre y la marca son obligatorios" });
    }

    const nuevaFamilia = new Familia({
      nombre,
      descripcion,
      marca
    });

    await nuevaFamilia.save();
    res.status(201).json({ mensaje: "Familia creada con éxito", familia: nuevaFamilia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear la familia" });
  }
};

// Actualizar una familia
const updateFamilia = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, marca } = req.body;

    const familia = await Familia.findById(id);
    if (!familia) {
      return res.status(404).json({ error: "Familia no encontrada" });
    }

    if (nombre) familia.nombre = nombre;
    if (descripcion !== undefined) familia.descripcion = descripcion;
    if (marca) familia.marca = marca;

    await familia.save();
    res.json({ mensaje: "Familia actualizada", familia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar la familia" });
  }
};

// Eliminar una familia
const deleteFamilia = async (req, res) => {
  try {
    const { id } = req.params;
    const familia = await Familia.findByIdAndDelete(id);
    
    if (!familia) {
      return res.status(404).json({ error: "Familia no encontrada" });
    }

    res.json({ mensaje: "Familia eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar la familia" });
  }
};

module.exports = {
  getFamilias,
  getFamiliaById,
  createFamilia,
  updateFamilia,
  deleteFamilia
};

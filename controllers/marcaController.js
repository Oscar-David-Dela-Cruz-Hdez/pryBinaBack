const Marca = require('../models/Marca');

// Obtener todas las marcas
const getMarcas = async (req, res) => {
  try {
    const marcas = await Marca.find();
    res.json(marcas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener marcas" });
  }
};

// Obtener una marca por ID
const getMarcaById = async (req, res) => {
  try {
    const { id } = req.params;
    const marca = await Marca.findById(id);
    if (!marca) {
      return res.status(404).json({ error: "Marca no encontrada" });
    }
    res.json(marca);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener la marca" });
  }
};

// Crear una nueva marca
const createMarca = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    // Validación básica
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const nuevaMarca = new Marca({
      nombre,
      descripcion
    });

    await nuevaMarca.save();
    res.status(201).json({ mensaje: "Marca creada con éxito", marca: nuevaMarca });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear la marca" });
  }
};

// Actualizar una marca
const updateMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    const marca = await Marca.findById(id);
    if (!marca) {
      return res.status(404).json({ error: "Marca no encontrada" });
    }

    if (nombre) marca.nombre = nombre;
    if (descripcion !== undefined) marca.descripcion = descripcion;

    await marca.save();
    res.json({ mensaje: "Marca actualizada", marca });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar la marca" });
  }
};

// Eliminar una marca
const deleteMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const marca = await Marca.findByIdAndDelete(id);
    
    if (!marca) {
      return res.status(404).json({ error: "Marca no encontrada" });
    }

    res.json({ mensaje: "Marca eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar la marca" });
  }
};

module.exports = {
  getMarcas,
  getMarcaById,
  createMarca,
  updateMarca,
  deleteMarca
};

const Categoria = require('../models/Categoria');

// Obtener todas las categorías
const getCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.find();
    res.json(categorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener categorías" });
  }
};

// Obtener una categoría por ID
const getCategoriaById = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await Categoria.findById(id);
    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }
    res.json(categoria);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener la categoría" });
  }
};

// Crear una nueva categoría
const createCategoria = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    // Validación básica
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const nuevaCategoria = new Categoria({
      nombre,
      descripcion
    });

    await nuevaCategoria.save();
    res.status(201).json({ mensaje: "Categoría creada con éxito", categoria: nuevaCategoria });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear la categoría" });
  }
};

// Actualizar una categoría
const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    const categoria = await Categoria.findById(id);
    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    if (nombre) categoria.nombre = nombre;
    if (descripcion !== undefined) categoria.descripcion = descripcion;

    await categoria.save();
    res.json({ mensaje: "Categoría actualizada", categoria });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar la categoría" });
  }
};

// Eliminar una categoría
const deleteCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await Categoria.findByIdAndDelete(id);
    
    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    res.json({ mensaje: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};

module.exports = {
  getCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria
};

const Producto = require('../models/Producto');

// Obtener todos los productos (con opción de buscar por nombre si se necesita en el futuro)
const getProductos = async (req, res) => {
  try {
    // Podríamos añadir filtros aquí si vienen en query params
    const productos = await Producto.find().populate('categoria', 'nombre');
    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

// Obtener un producto por ID
const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id).populate('categoria', 'nombre');
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    res.json(producto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el producto" });
  }
};

// Crear un nuevo producto
const createProducto = async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria, imagenUrl } = req.body;
    
    if (!nombre || !precio) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const nuevoProducto = new Producto({
      nombre,
      descripcion,
      precio,
      stock,
      categoria,
      imagenUrl
    });

    await nuevoProducto.save();
    res.status(201).json({ mensaje: "Producto creado con éxito", producto: nuevoProducto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear el producto" });
  }
};

// Actualizar un producto
const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, imagenUrl } = req.body;

    const producto = await Producto.findByIdAndUpdate(
      id,
      { nombre, descripcion, precio, stock, categoria, imagenUrl },
      { new: true } // Devuelve el objeto actualizado
    );

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto actualizado", producto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el producto" });
  }
};

// Eliminar un producto
const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findByIdAndDelete(id);

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar el producto" });
  }
};

module.exports = {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto
};

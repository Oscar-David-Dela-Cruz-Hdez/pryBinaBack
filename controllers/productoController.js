const Producto = require('../models/Producto');

const getProductos = async (req, res) => {
  try {
    const { categoria, nombre } = req.query;
    let query = {};

    if (categoria) {
      query.categoria = categoria;
    }

    if (nombre) {
      // Búsqueda insensible a mayúsculas/minúsculas
      query.nombre = { $regex: nombre, $options: 'i' };
    }

    // Solo devolver productos activos por defecto, salvo que se pida lo contrario en admin
    // query.activo = true; // (Opcional: descomentar si se quiere forzar)

    const productos = await Producto.find(query)
      .populate('categoria', 'nombre')
      .populate('proveedor', 'nombre');
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
    const producto = await Producto.findById(id)
      .populate('categoria', 'nombre')
      .populate('proveedor', 'nombre');
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
    const { nombre, descripcion, precio, stock, categoria, proveedor, sku, imagenUrl, activo } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const nuevoProducto = new Producto({
      nombre,
      descripcion,
      precio,
      stock,
      categoria,
      proveedor,
      sku,
      imagenUrl,
      activo
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
    const { nombre, descripcion, precio, stock, categoria, proveedor, sku, imagenUrl, activo } = req.body;

    const producto = await Producto.findByIdAndUpdate(
      id,
      { nombre, descripcion, precio, stock, categoria, proveedor, sku, imagenUrl, activo },
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

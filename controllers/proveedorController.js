const Proveedor = require("../models/Proveedor");
const filterXSS = require('xss');

const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  if (typeof dato === 'string') {
      const strDato = String(dato).trim();
      return filterXSS(strDato);
  }
  return dato; 
};

// Obtener todos los proveedores
const getProveedores = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = {};
    if (activo === 'true') {
        query.activo = true;
    }
    const proveedores = await Proveedor.find(query);
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
};

// Obtener un proveedor por ID
const getProveedorById = async (req, res) => {
    try {
        const { id } = req.params;
        const proveedor = await Proveedor.findById(id);
        if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
        res.json(proveedor);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener proveedor" });
    }
};

// Crear Proveedor (Admin)
const createProveedor = async (req, res) => {
  try {
    const { nombre, contacto, email, telefono, direccion, sitioWeb, activo } = req.body;
    
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

    // Validar duplicados por nombre o email si se desea (opcional)
    const existing = await Proveedor.findOne({ nombre: limpiarDato(nombre) });
    if (existing) return res.status(400).json({ error: "Ya existe un proveedor con este nombre" });

    const nuevoProveedor = new Proveedor({
        nombre: limpiarDato(nombre),
        contacto: limpiarDato(contacto),
        email: limpiarDato(email),
        telefono: limpiarDato(telefono),
        direccion: limpiarDato(direccion),
        sitioWeb: limpiarDato(sitioWeb),
        activo: activo !== undefined ? activo : true
    });

    await nuevoProveedor.save();
    res.status(201).json({ mensaje: "Proveedor creado", proveedor: nuevoProveedor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear proveedor" });
  }
};

// Actualizar Proveedor (Admin)
const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, contacto, email, telefono, direccion, sitioWeb, activo } = req.body;

    const datosActualizar = {};
    if (nombre !== undefined) datosActualizar.nombre = limpiarDato(nombre);
    if (contacto !== undefined) datosActualizar.contacto = limpiarDato(contacto);
    if (email !== undefined) datosActualizar.email = limpiarDato(email);
    if (telefono !== undefined) datosActualizar.telefono = limpiarDato(telefono);
    if (direccion !== undefined) datosActualizar.direccion = limpiarDato(direccion);
    if (sitioWeb !== undefined) datosActualizar.sitioWeb = limpiarDato(sitioWeb);
    if (activo !== undefined) datosActualizar.activo = activo;

    const proveedorActualizado = await Proveedor.findByIdAndUpdate(id, datosActualizar, { new: true });
    
    if (!proveedorActualizado) return res.status(404).json({ error: "Proveedor no encontrado" });

    res.json({ mensaje: "Proveedor actualizado", proveedor: proveedorActualizado });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar proveedor" });
  }
};

// Eliminar Proveedor (Admin)
const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const proveedorEliminado = await Proveedor.findByIdAndDelete(id);
    
    if (!proveedorEliminado) return res.status(404).json({ error: "Proveedor no encontrado" });

    res.json({ mensaje: "Proveedor eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar proveedor" });
  }
};

module.exports = {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor
};

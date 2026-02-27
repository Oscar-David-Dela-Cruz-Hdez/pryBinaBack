const Oferta = require("../models/Oferta");
const Producto = require("../models/Producto");

// Obtener todas las ofertas activas e inactivas (Admin)
const getOfertas = async (req, res) => {
  try {
    const ofertas = await Oferta.find()
      .populate('productos', 'nombre')
      .populate('categorias', 'nombre')
      .sort({ createdAt: -1 });
    res.json(ofertas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ofertas" });
  }
};

// Obtener una oferta por ID
const getOfertaById = async (req, res) => {
  try {
    const { id } = req.params;
    const oferta = await Oferta.findById(id)
      .populate('productos', 'nombre')
      .populate('categorias', 'nombre');
    if (!oferta) return res.status(404).json({ error: "Oferta no encontrada" });
    res.json(oferta);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener oferta" });
  }
};

// Crear Oferta (Admin)
const createOferta = async (req, res) => {
  try {
    const { nombre, descripcion, tipoDescuento, valorDescuento, productos, categorias, fechaInicio, fechaFin, activo } = req.body;
    
    if (!nombre || !tipoDescuento || valorDescuento === undefined || !fechaInicio || !fechaFin) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const nuevaOferta = new Oferta({
      nombre,
      descripcion,
      tipoDescuento,
      valorDescuento,
      productos: productos || [],
      categorias: categorias || [],
      fechaInicio,
      fechaFin,
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
    const { nombre, descripcion, tipoDescuento, valorDescuento, productos, categorias, fechaInicio, fechaFin, activo } = req.body;

    const datosActualizar = {};
    if (nombre !== undefined) datosActualizar.nombre = nombre;
    if (descripcion !== undefined) datosActualizar.descripcion = descripcion;
    if (tipoDescuento !== undefined) datosActualizar.tipoDescuento = tipoDescuento;
    if (valorDescuento !== undefined) datosActualizar.valorDescuento = valorDescuento;
    if (productos !== undefined) datosActualizar.productos = productos;
    if (categorias !== undefined) datosActualizar.categorias = categorias;
    if (fechaInicio !== undefined) datosActualizar.fechaInicio = fechaInicio;
    if (fechaFin !== undefined) datosActualizar.fechaFin = fechaFin;
    if (activo !== undefined) datosActualizar.activo = activo;

    const ofertaActualizada = await Oferta.findByIdAndUpdate(id, datosActualizar, { new: true })
      .populate('productos', 'nombre')
      .populate('categorias', 'nombre');
    
    if (!ofertaActualizada) return res.status(404).json({ error: "Oferta no encontrada" });

    res.json({ mensaje: "Oferta actualizada", oferta: ofertaActualizada });
  } catch (error) {
    console.error(error);
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

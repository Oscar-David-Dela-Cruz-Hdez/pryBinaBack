const MetodoPago = require("../models/MetodoPago");
const filterXSS = require('xss');

const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  if (typeof dato === 'string') {
      const strDato = String(dato).trim();
      return filterXSS(strDato);
  }
  return dato; 
};

// Obtener todos los métodos de pago
// Admin puede ver todos, usuario público quizás solo los activos.
// Aquí dejamos un filtro opcional por query ?activo=true
const getMetodosPago = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = {};
    if (activo === 'true') {
        query.activo = true;
    }
    const metodos = await MetodoPago.find(query);
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener métodos de pago" });
  }
};

// Obtener un método por ID
const getMetodoPagoById = async (req, res) => {
    try {
        const { id } = req.params;
        const metodo = await MetodoPago.findById(id);
        if (!metodo) return res.status(404).json({ error: "Método de pago no encontrado" });
        res.json(metodo);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener método de pago" });
    }
};

// Crear Método de Pago (Admin)
const createMetodoPago = async (req, res) => {
  try {
    const { nombre, descripcion, instrucciones, icono, activo } = req.body;
    
    // Validación básica
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

    const nuevoMetodo = new MetodoPago({
        nombre: limpiarDato(nombre),
        descripcion: limpiarDato(descripcion),
        instrucciones: limpiarDato(instrucciones),
        icono: limpiarDato(icono),
        activo: activo !== undefined ? activo : true
    });

    await nuevoMetodo.save();
    res.status(201).json({ mensaje: "Método de pago creado", metodo: nuevoMetodo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear método de pago" });
  }
};

// Actualizar Método de Pago (Admin)
const updateMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, instrucciones, icono, activo } = req.body;

    const datosActualizar = {};
    if (nombre !== undefined) datosActualizar.nombre = limpiarDato(nombre);
    if (descripcion !== undefined) datosActualizar.descripcion = limpiarDato(descripcion);
    if (instrucciones !== undefined) datosActualizar.instrucciones = limpiarDato(instrucciones);
    if (icono !== undefined) datosActualizar.icono = limpiarDato(icono);
    if (activo !== undefined) datosActualizar.activo = activo;

    const metodoActualizado = await MetodoPago.findByIdAndUpdate(id, datosActualizar, { new: true });
    
    if (!metodoActualizado) return res.status(404).json({ error: "Método de pago no encontrado" });

    res.json({ mensaje: "Método de pago actualizado", metodo: metodoActualizado });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar método de pago" });
  }
};

// Eliminar Método de Pago (Admin)
const deleteMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const metodoEliminado = await MetodoPago.findByIdAndDelete(id);
    
    if (!metodoEliminado) return res.status(404).json({ error: "Método de pago no encontrado" });

    res.json({ mensaje: "Método de pago eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar método de pago" });
  }
};

module.exports = {
  getMetodosPago,
  getMetodoPagoById,
  createMetodoPago,
  updateMetodoPago,
  deleteMetodoPago
};

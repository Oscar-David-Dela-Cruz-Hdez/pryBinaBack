const MetodoEnvio = require("../models/MetodoEnvio");
const filterXSS = require('xss');

const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  if (typeof dato === 'string') {
      const strDato = String(dato).trim();
      return filterXSS(strDato);
  }
  return dato; 
};

// Obtener todos los métodos de envío
// ?activo=true para mostrar solo los disponibles al usuario
const getMetodosEnvio = async (req, res) => {
  try {
    const { activo } = req.query;
    let query = {};
    if (activo === 'true') {
        query.activo = true;
    }
    // Ordenamos por costo ascendente por defecto
    const metodos = await MetodoEnvio.find(query).sort({ costo: 1 });
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener métodos de envío" });
  }
};

// Obtener un método por ID
const getMetodoEnvioById = async (req, res) => {
    try {
        const { id } = req.params;
        const metodo = await MetodoEnvio.findById(id);
        if (!metodo) return res.status(404).json({ error: "Método de envío no encontrado" });
        res.json(metodo);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener método de envío" });
    }
};

// Crear Método de Envío (Admin)
const createMetodoEnvio = async (req, res) => {
  try {
    const { nombre, descripcion, costo, tipo, tiempoEstimado, activo } = req.body;
    
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

    const nuevoMetodo = new MetodoEnvio({
        nombre: limpiarDato(nombre),
        descripcion: limpiarDato(descripcion),
        costo: Number(costo) || 0,
        tipo: limpiarDato(tipo) || "nacional",
        tiempoEstimado: limpiarDato(tiempoEstimado),
        activo: activo !== undefined ? activo : true
    });

    await nuevoMetodo.save();
    res.status(201).json({ mensaje: "Método de envío creado", metodo: nuevoMetodo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear método de envío" });
  }
};

// Actualizar Método de Envío (Admin)
const updateMetodoEnvio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, costo, tipo, tiempoEstimado, activo } = req.body;

    const datosActualizar = {};
    if (nombre !== undefined) datosActualizar.nombre = limpiarDato(nombre);
    if (descripcion !== undefined) datosActualizar.descripcion = limpiarDato(descripcion);
    if (costo !== undefined) datosActualizar.costo = Number(costo);
    if (tipo !== undefined) datosActualizar.tipo = limpiarDato(tipo);
    if (tiempoEstimado !== undefined) datosActualizar.tiempoEstimado = limpiarDato(tiempoEstimado);
    if (activo !== undefined) datosActualizar.activo = activo;

    const metodoActualizado = await MetodoEnvio.findByIdAndUpdate(id, datosActualizar, { new: true });
    
    if (!metodoActualizado) return res.status(404).json({ error: "Método de envío no encontrado" });

    res.json({ mensaje: "Método de envío actualizado", metodo: metodoActualizado });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar método de envío" });
  }
};

// Eliminar Método de Envío (Admin)
const deleteMetodoEnvio = async (req, res) => {
  try {
    const { id } = req.params;
    const metodoEliminado = await MetodoEnvio.findByIdAndDelete(id);
    
    if (!metodoEliminado) return res.status(404).json({ error: "Método de envío no encontrado" });

    res.json({ mensaje: "Método de envío eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar método de envío" });
  }
};

module.exports = {
  getMetodosEnvio,
  getMetodoEnvioById,
  createMetodoEnvio,
  updateMetodoEnvio,
  deleteMetodoEnvio
};

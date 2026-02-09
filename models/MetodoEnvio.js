const mongoose = require("mongoose");

const metodoEnvioSchema = new mongoose.Schema({
  nombre: { type: String, required: true }, // Ej: "Envío Estándar", "Recoger en Tienda"
  descripcion: { type: String }, // Ej: "Entrega de 3 a 5 días hábiles"
  costo: { type: Number, required: true, default: 0 }, // Costo base del envío
  tipo: { 
    type: String, 
    enum: ["local", "nacional", "pickup"], 
    default: "nacional" 
  }, // Para lógica interna si es necesario
  tiempoEstimado: { type: String }, // Ej: "24-48 horas", "Inmediato"
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("MetodoEnvio", metodoEnvioSchema);

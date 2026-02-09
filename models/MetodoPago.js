const mongoose = require("mongoose");

const metodoPagoSchema = new mongoose.Schema({
  nombre: { type: String, required: true }, // Ej: "Transferencia Bancaria", "Tarjeta de Crédito"
  descripcion: { type: String }, // Ej: "Paga directamente a nuestra cuenta..."
  instrucciones: { type: String }, // Ej: "Cuenta: 123456, Banco: XYZ"
  icono: { type: String }, // URL de imagen o nombre de icono
  activo: { type: Boolean, default: true } // Para activar/desactivar sin borrar
}, { timestamps: true });

module.exports = mongoose.model("MetodoPago", metodoPagoSchema);

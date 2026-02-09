const mongoose = require("mongoose");

const proveedorSchema = new mongoose.Schema({
  nombre: { type: String, required: true }, // Nombre de la empresa o proveedor
  contacto: { type: String }, // Persona de contacto
  email: { type: String },
  telefono: { type: String },
  direccion: { type: String },
  sitioWeb: { type: String },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Proveedor", proveedorSchema);

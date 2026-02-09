const mongoose = require("mongoose");

const ofertaSchema = new mongoose.Schema({
  titulo: { type: String }, // Opcional: Texto alternativo o título
  imagenUrl: { type: String, required: true }, // URL de la imagen del banner
  enlaceDestino: { type: String }, // Opcional: URL a donde lleva al hacer click
  orden: { type: Number, default: 0 }, // Para controlar el orden en el carrusel
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Oferta", ofertaSchema);

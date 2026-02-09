const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema({
  pregunta: { type: String, required: true },
  respuesta: { type: String, required: true }
});

const contactoSchema = new mongoose.Schema({
  tipo: { type: String, required: true }, // 'email', 'telefono', 'whatsapp', 'facebook', etc.
  valor: { type: String, required: true },
  icono: { type: String } // Opcional: para nombre de icono en UI
});

const informacionSchema = new mongoose.Schema({
  mision: { type: String, default: "" },
  vision: { type: String, default: "" },
  preguntasFrecuentes: [faqSchema],
  ubicacion: {
    direccion: { type: String, default: "" },
    latitud: { type: Number },
    longitud: { type: Number },
    googleMapsUrl: { type: String }
  },
  contactos: [contactoSchema],
  politicasPrivacidad: { type: String, default: "" },
  terminosServicio: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Informacion", informacionSchema);

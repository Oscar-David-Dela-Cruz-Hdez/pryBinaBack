const mongoose = require("mongoose");

const contactoSchema = new mongoose.Schema({
    tipo: { type: String, required: true }, // Ej: 'whatsapp', 'email'
    valor: { type: String, required: true }, // Ej: '+52...', 'admin@test.com'
    icono: { type: String }, // Nombre del icono de Material Design o URL
    activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Contacto", contactoSchema);

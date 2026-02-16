const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema({
    pregunta: { type: String, required: true },
    respuesta: { type: String, required: true },
    activo: { type: Boolean, default: true },
    orden: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Faq", faqSchema);

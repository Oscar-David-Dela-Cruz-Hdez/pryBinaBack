const mongoose = require("mongoose");

const ubicacionSchema = new mongoose.Schema({
    direccion: { type: String, default: "" },
    latitud: { type: Number },
    longitud: { type: Number },
    googleMapsUrl: { type: String },
    telefono: { type: String },
    horario: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("Ubicacion", ubicacionSchema);

const mongoose = require("mongoose");

const empresaSchema = new mongoose.Schema({
    mision: { type: String, default: "" },
    vision: { type: String, default: "" },
    historia: { type: String, default: "" },
    politicasPrivacidad: { type: String, default: "" },
    terminosServicio: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Empresa", empresaSchema);

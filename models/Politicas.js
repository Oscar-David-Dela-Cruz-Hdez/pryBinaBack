const mongoose = require("mongoose");

const politicasSchema = new mongoose.Schema({
    texto: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Politicas", politicasSchema);

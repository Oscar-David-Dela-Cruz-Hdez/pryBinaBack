const mongoose = require("mongoose");

const misionSchema = new mongoose.Schema({
    texto: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Mision", misionSchema);

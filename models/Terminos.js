const mongoose = require("mongoose");

const terminosSchema = new mongoose.Schema({
    texto: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Terminos", terminosSchema);

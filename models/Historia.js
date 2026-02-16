const mongoose = require("mongoose");

const historiaSchema = new mongoose.Schema({
    texto: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Historia", historiaSchema);

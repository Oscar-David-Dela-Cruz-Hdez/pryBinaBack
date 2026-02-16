const mongoose = require("mongoose");

const visionSchema = new mongoose.Schema({
    texto: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Vision", visionSchema);

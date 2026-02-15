const mongoose = require("mongoose");

const pedidoSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    productos: [{
        producto: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Producto",
            required: true
        },
        cantidad: { type: Number, required: true },
        precio: { type: Number, required: true }, // Precio al momento de la compra
        nombre: { type: String } // Snapshot del nombre
    }],
    total: { type: Number, required: true },
    direccionEnvio: {
        calle: { type: String, required: true },
        ciudad: { type: String, required: true },
        estado: { type: String, required: true },
        cp: { type: String, required: true },
        telefono: { type: String, required: true }
    },
    metodoPago: { type: String, required: true }, // "Tarjeta", "Transferencia", etc.
    estado: {
        type: String,
        enum: ["Pendiente", "Pagado", "Enviado", "Entregado", "Cancelado", "Devolución"],
        default: "Pendiente"
    },
    costoEnvio: { type: Number, default: 0 },
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Pedido", pedidoSchema);

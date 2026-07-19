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
    pago: {
        proveedor: { type: String, enum: ["paypal", "manual"], default: "manual" },
        estado: {
            type: String,
            enum: ["pendiente", "procesando", "aprobado", "rechazado", "cancelado", "reembolsado"],
            default: "pendiente"
        },
        ordenExternaId: { type: String, index: true, sparse: true },
        capturaId: { type: String },
        moneda: { type: String, default: "MXN" },
        monto: { type: Number },
        fechaPago: { type: Date },
        expiraEn: { type: Date, index: true },
        fechaCancelacion: { type: Date },
        motivoCancelacion: { type: String }
    },
    estado: {
        type: String,
        enum: ["Pendiente", "Pagado", "Enviado", "Entregado", "Cancelado", "Devolución"],
        default: "Pendiente"
    },
    costoEnvio: { type: Number, default: 0 },
    inventarioReservado: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Pedido", pedidoSchema);

const mongoose = require("mongoose");

const ofertaSchema = new mongoose.Schema({
  nombre: { type: String, required: true }, // Ej: "Buen Fin 2026 - Tintes"
  descripcion: { type: String },
  
  // ¿Cómo se descuenta el precio?
  tipoDescuento: { 
    type: String, 
    enum: ['porcentaje', 'monto_fijo'], 
    required: true 
  }, // Ej: 'porcentaje'
  valorDescuento: { type: Number, required: true }, // Ej: 15 (repr. 15%)
  
  // ¿A qué aplica?
  productos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Producto' }],
  categorias: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' }],
  
  // Vigencia
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date, required: true },
  
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Oferta", ofertaSchema);

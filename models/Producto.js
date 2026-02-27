const mongoose = require('mongoose');

const varianteSchema = new mongoose.Schema({
  sku: { type: String, required: false },
  precio: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  imagenUrl: { type: String, required: false },
  atributos: {
    type: Map,
    of: String 
  }
});

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: false
  },
  precio: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoria',
    required: false
  },
  sku: {
    type: String,
    required: false
  },
  activo: {
    type: Boolean,
    default: true
  },
  imagenUrl: {
    type: String,
    required: false
  },
  
  // ---- CAMPOS PARA VARIANTES ----
  tieneVariantes: {
    type: Boolean,
    default: false
  },
  variantes: [varianteSchema],
  
  // ---- CAMPOS ORIGINALES BASE ----
  precioBase: { type: Number },
  stockTotal: { type: Number, default: 0 },
  skuBase: { type: String },
  imagenUrlPrincipal: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Producto', productoSchema);

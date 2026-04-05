const mongoose = require('mongoose');

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
  precioNormal: {
    type: Number,
    required: false
  },
  skuNormal: {
    type: String,
    required: false
  },
  precioMayoreo: {
    type: Number,
    required: false
  },
  skuMayoreo: {
    type: String,
    required: false
  },
  precioCaja: {
    type: Number,
    required: false
  },
  skuCaja: {
    type: String,
    required: false
  },
  stock: {
    type: Number,
    default: 0
  },
  // La Marca a la que pertenece
  marca: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marca',
    required: false
  },
  // La Familia a la que pertenece
  familia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Familia',
    required: false
  },
  activo: {
    type: Boolean,
    default: true
  },
  imagenUrl: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Producto', productoSchema);

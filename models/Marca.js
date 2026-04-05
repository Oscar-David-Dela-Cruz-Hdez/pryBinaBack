const mongoose = require('mongoose');

const marcaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Marca', marcaSchema);

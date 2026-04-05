const mongoose = require('mongoose');

const familiaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: false
  },
  marca: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marca',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Familia', familiaSchema);

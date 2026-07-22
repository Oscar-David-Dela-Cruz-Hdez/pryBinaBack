const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const direccionSchema = new mongoose.Schema({
  alias: { type: String, required: true, trim: true },
  calle: { type: String, required: true, trim: true },
  colonia: { type: String, trim: true },
  ciudad: { type: String, required: true, trim: true },
  estado: { type: String, required: true, trim: true },
  cp: { type: String, required: true, trim: true },
  telefono: { type: String, required: true, trim: true },
  referencias: { type: String, trim: true },
  predeterminada: { type: Boolean, default: false }
}, { timestamps: true });

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ap: { type: String, required: false },
  am: { type: String, required: false },
  fechaNacimiento: { type: Date, required: false },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  telefono: { type: String, required: false },
  preguntaSecreta: { type: String, required: false },
  respuestaSecreta: { type: String, required: false },
  rol: { type: String, enum: ["usuario", "admin"], default: "usuario" },
  loginCode: { type: String },
  loginCodeExpires: { type: Date },
  alexaTokenHash: { type: String },
  alexaTokenLast4: { type: String },
  alexaTokenUpdatedAt: { type: Date },
  activeTokens: { type: [String], default: [] }
  ,direcciones: { type: [direccionSchema], default: [] }
});

usuarioSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

usuarioSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.activeTokens;
    delete ret.alexaTokenHash;
    return ret;
  },
});

const Usuario = mongoose.model("Usuario", usuarioSchema);

module.exports = Usuario;

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ap: { type: String, required: false },
  am: { type: String, required: false },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  telefono: { type: String, required: false },
  preguntaSecreta: { type: String, required: false },
  respuestaSecreta: { type: String, required: false },
  rol: { type: String, enum: ["usuario", "admin"], default: "usuario" },

  loginCode: { type: String },
  loginCodeExpires: { type: Date }
});

usuarioSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

usuarioSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  },
});

const Usuario = mongoose.model("Usuario", usuarioSchema);

module.exports = Usuario;
